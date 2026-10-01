import { ipcMain } from "electron";
import { supabase, handleSupabase } from "./utils";

export function setupRentalIPC() {
  // Get all rental agreements
  ipcMain.handle("rentals:getAll", async () => {
    const { data, error } = await supabase
      .from("rental_agreements")
      .select(`
        *,
        clients:client_id ( id, name, email, phone, company_name ),
        vehicles:vehicle_id ( id, plate, brand, model, vehicle_type, rental_rate_per_day, security_deposit_amount, category, transmission ),
        employees:driver_id ( id, full_name, phone )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching rental agreements:", error);
      return [];
    }
    return data || [];
  });

  // Get rental agreement by ID
  ipcMain.handle("rentals:getById", async (_, id: number | string) => {
    const { data, error } = await supabase
      .from("rental_agreements")
      .select(`
        *,
        clients:client_id ( * ),
        vehicles:vehicle_id ( * ),
        employees:driver_id ( * )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching rental agreement:", error);
      return null;
    }

    // Fetch inspections
    const { data: inspections } = await supabase
      .from("rental_inspections")
      .select("*")
      .eq("agreement_id", id)
      .order("created_at", { ascending: true });

    return { ...data, inspections: inspections || [] };
  });

  // Check vehicle availability for date range
  ipcMain.handle("rentals:checkAvailability", async (_, payload: { vehicle_id: number | string; start_datetime: string; end_datetime: string; exclude_agreement_id?: number | string }) => {
    const { vehicle_id, start_datetime, end_datetime, exclude_agreement_id } = payload;

    // Check overlapping rental agreements
    let query = supabase
      .from("rental_agreements")
      .select("id, agreement_number, start_datetime, expected_return_datetime, rental_status")
      .eq("vehicle_id", vehicle_id)
      .in("rental_status", ["Reserved", "Active"])
      .or(`and(start_datetime.lte.${end_datetime},expected_return_datetime.gte.${start_datetime})`);

    if (exclude_agreement_id) {
      query = query.neq("id", exclude_agreement_id);
    }

    const { data: overlappingRentals, error: rentalErr } = await query;
    if (rentalErr) {
      console.error("Error checking rental availability:", rentalErr);
    }

    // Also check overlapping active hauling trips for this vehicle
    const { data: overlappingTrips } = await supabase
      .from("trips")
      .select("id, trip_number, pickup_time, delivery_time, status")
      .eq("vehicle_id", vehicle_id)
      .in("status", ["scheduled", "in transit", "in-transit"])
      .or(`and(pickup_time.lte.${end_datetime},delivery_time.gte.${start_datetime})`);

    const isAvailable = (!overlappingRentals || overlappingRentals.length === 0) && (!overlappingTrips || overlappingTrips.length === 0);

    return {
      available: isAvailable,
      conflictingRentals: overlappingRentals || [],
      conflictingTrips: overlappingTrips || []
    };
  });

  // Create rental agreement
  ipcMain.handle("rentals:create", async (_, payload: any) => {
    // Validate required fields
    if (!payload.client_id || !payload.vehicle_id || !payload.start_datetime || !payload.expected_return_datetime) {
      return { success: false, ok: false, error: "Missing required rental parameters (client, vehicle, start date, expected return date)." };
    }

    // Generate Agreement Number if not provided
    if (!payload.agreement_number) {
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      payload.agreement_number = `RNT-${year}-${randomSuffix}`;
    }

    // Compute rental calculations if needed
    const startDate = new Date(payload.start_datetime);
    const endDate = new Date(payload.expected_return_datetime);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    payload.total_days = payload.total_days || diffDays;
    payload.base_rental_amount = payload.base_rental_amount || (Number(payload.daily_rate || 0) * payload.total_days);
    payload.total_amount = payload.total_amount || (payload.base_rental_amount + Number(payload.additional_charges || 0) + Number(payload.late_fee || 0) + Number(payload.fuel_fee || 0) + Number(payload.damage_fee || 0) - Number(payload.discount_amount || 0));

    const result = await handleSupabase(
      supabase.from("rental_agreements").insert([payload]).select()
    );

    // If successfully created, update vehicle status if start date is today
    if (result.success && result.data && result.data.length > 0) {
      const created = result.data[0];
      if (created.rental_status === "Active") {
        await supabase.from("vehicles").update({ status: "in-use" }).eq("id", payload.vehicle_id);
      }
    }

    return result;
  });

  // Update rental agreement status
  ipcMain.handle("rentals:updateStatus", async (_, id: number | string, status: string) => {
    const { data: agreement } = await supabase
      .from("rental_agreements")
      .select("vehicle_id")
      .eq("id", id)
      .single();

    const result = await handleSupabase(
      supabase
        .from("rental_agreements")
        .update({ rental_status: status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
    );

    if (result.success && agreement) {
      if (status === "Active") {
        await supabase.from("vehicles").update({ status: "in-use" }).eq("id", agreement.vehicle_id);
      } else if (status === "Returned" || status === "Completed" || status === "Cancelled") {
        await supabase.from("vehicles").update({ status: "available" }).eq("id", agreement.vehicle_id);
      }
    }

    return result;
  });

  // Record Vehicle Checkout (Start Active Rental)
  ipcMain.handle("rentals:checkout", async (_, payload: { agreement_id: number | string; odometer_reading: number; fuel_level_percentage: number; body_condition_notes?: string; inspector_id?: string; customer_signature?: string }) => {
    const { agreement_id, odometer_reading, fuel_level_percentage, body_condition_notes, inspector_id, customer_signature } = payload;

    // 1. Insert inspection record
    const { error: inspErr } = await supabase.from("rental_inspections").insert([{
      agreement_id,
      inspection_type: "checkout",
      odometer_reading,
      fuel_level_percentage,
      body_condition_notes: body_condition_notes || "Checkout Inspection",
      inspector_id,
      customer_signature
    }]);

    if (inspErr) {
      return { success: false, ok: false, error: inspErr.message };
    }

    // 2. Update agreement status to Active
    const { data: agreement, error: agrErr } = await supabase
      .from("rental_agreements")
      .update({ rental_status: "Active", updated_at: new Date().toISOString() })
      .eq("id", agreement_id)
      .select()
      .single();

    if (agrErr) {
      return { success: false, ok: false, error: agrErr.message };
    }

    // 3. Mark vehicle as in-use
    if (agreement && agreement.vehicle_id) {
      await supabase.from("vehicles").update({ status: "in-use" }).eq("id", agreement.vehicle_id);
    }

    return { success: true, ok: true, data: agreement };
  });

  // Record Vehicle Return (Complete Rental)
  ipcMain.handle("rentals:return", async (_, payload: { agreement_id: number | string; actual_return_datetime: string; odometer_reading: number; fuel_level_percentage: number; late_fee?: number; fuel_fee?: number; damage_fee?: number; additional_charges?: number; body_condition_notes?: string; inspector_id?: string; customer_signature?: string }) => {
    const { agreement_id, actual_return_datetime, odometer_reading, fuel_level_percentage, late_fee = 0, fuel_fee = 0, damage_fee = 0, additional_charges = 0, body_condition_notes, inspector_id, customer_signature } = payload;

    // 1. Insert return inspection record
    const { error: inspErr } = await supabase.from("rental_inspections").insert([{
      agreement_id,
      inspection_type: "return",
      odometer_reading,
      fuel_level_percentage,
      body_condition_notes: body_condition_notes || "Return Inspection",
      inspector_id,
      customer_signature
    }]);

    if (inspErr) {
      return { success: false, ok: false, error: inspErr.message };
    }

    // 2. Fetch original agreement to compute final total
    const { data: current } = await supabase
      .from("rental_agreements")
      .select("*")
      .eq("id", agreement_id)
      .single();

    if (!current) {
      return { success: false, ok: false, error: "Rental agreement not found." };
    }

    const totalLate = Number(late_fee);
    const totalFuel = Number(fuel_fee);
    const totalDamage = Number(damage_fee);
    const totalAdd = Number(additional_charges);
    const finalTotal = Number(current.base_rental_amount) + totalLate + totalFuel + totalDamage + totalAdd - Number(current.discount_amount || 0);

    // 3. Update agreement to Returned & Completed
    const { data: updatedAgreement, error: updateErr } = await supabase
      .from("rental_agreements")
      .update({
        rental_status: "Returned",
        payment_status: "Pending",
        actual_return_datetime,
        late_fee: totalLate,
        fuel_fee: totalFuel,
        damage_fee: totalDamage,
        additional_charges: totalAdd,
        total_amount: finalTotal,
        updated_at: new Date().toISOString()
      })
      .eq("id", agreement_id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, ok: false, error: updateErr.message };
    }

    // 4. Return vehicle to available status
    if (current.vehicle_id) {
      await supabase.from("vehicles").update({ status: "available" }).eq("id", current.vehicle_id);
    }

    // 5. Auto-generate Rental Invoice in invoices table
    const invoiceNum = `INV-RNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await supabase.from("invoices").insert([{
      invoice_number: invoiceNum,
      client_id: current.client_id,
      vehicle_id: current.vehicle_id,
      driver_id: current.driver_id || null,
      rental_agreement_id: current.id,
      invoice_type: "rental",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      amount: finalTotal,
      status: "Pending",
      description: `Car Rental Agreement ${current.agreement_number} - Final Settlement`
    }]);

    return { success: true, ok: true, data: updatedAgreement, invoice_number: invoiceNum };
  });

  // Delete rental agreement
  ipcMain.handle("rentals:delete", async (_, id: number | string) => {
    return handleSupabase(supabase.from("rental_agreements").delete().eq("id", id));
  });
}
