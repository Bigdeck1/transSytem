export interface PackageInput {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  actualWeightKg: number;
  distanceKm?: number;
  isFragile?: boolean;
  isExpress?: boolean;
}

export interface EstimationResult {
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  volumeCbm: number;
  recommendedVehicle: string;
  basePrice: number;
  distanceCost: number;
  weightCost: number;
  surcharges: number;
  totalEstimatedCost: number;
}

export function calculatePackageEstimate(input: PackageInput): EstimationResult {
  const length = Math.max(0, Number(input.lengthCm) || 0);
  const width = Math.max(0, Number(input.widthCm) || 0);
  const height = Math.max(0, Number(input.heightCm) || 0);
  const actualWeight = Math.max(0, Number(input.actualWeightKg) || 0);
  const distanceKm = Math.max(1, Number(input.distanceKm) || 10);
  const isFragile = Boolean(input.isFragile);
  const isExpress = Boolean(input.isExpress);

  // Volumetric calculation (industry divisor 5000 cm³/kg)
  const volumeCbm = (length * width * height) / 1_000_000;
  const volumetricWeightKg = (length * width * height) / 5000;
  const chargeableWeightKg = Math.max(actualWeight, volumetricWeightKg);

  // Vehicle recommendation & tier rates
  let recommendedVehicle = "Sedan / Light Van";
  let basePrice = 250;
  let ratePerKm = 25;
  let ratePerKg = 8;

  if (chargeableWeightKg > 4000 || volumeCbm > 15) {
    recommendedVehicle = "10-Wheeler Wing Van";
    basePrice = 3500;
    ratePerKm = 85;
    ratePerKg = 2.5;
  } else if (chargeableWeightKg > 1500 || volumeCbm > 8) {
    recommendedVehicle = "6-Wheeler Forward Truck";
    basePrice = 1800;
    ratePerKm = 55;
    ratePerKg = 4;
  } else if (chargeableWeightKg > 300 || volumeCbm > 2) {
    recommendedVehicle = "4-Wheeler L300 / Cargo Van";
    basePrice = 650;
    ratePerKm = 35;
    ratePerKg = 6;
  }

  const distanceCost = distanceKm * ratePerKm;
  const weightCost = chargeableWeightKg * ratePerKg;
  let surcharges = 0;
  if (isFragile) surcharges += 250; // Fragile handling fee
  if (isExpress) surcharges += (basePrice + distanceCost) * 0.25; // 25% express surcharge

  const totalEstimatedCost = Math.round(basePrice + distanceCost + weightCost + surcharges);

  return {
    volumetricWeightKg: Number(volumetricWeightKg.toFixed(2)),
    chargeableWeightKg: Number(chargeableWeightKg.toFixed(2)),
    volumeCbm: Number(volumeCbm.toFixed(3)),
    recommendedVehicle,
    basePrice,
    distanceCost: Math.round(distanceCost),
    weightCost: Math.round(weightCost),
    surcharges: Math.round(surcharges),
    totalEstimatedCost,
  };
}
