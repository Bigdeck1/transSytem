<?php
// ============================================================
// JRR Transportation — api.php (Supabase REST API Proxy)
// Handles: booking submissions + admin actions directly to Supabase
// ============================================================

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$SUPABASE_URL = "https://uocavssoqmwjstmvdgwq.supabase.co";
// Using Service Role Key to safely insert data from backend bypassing RLS
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvY2F2c3NvcW13anN0bXZkZ3dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk5ODY2MSwiZXhwIjoyMDc3NTc0NjYxfQ.8o4rxYuJKin51uITCILIyd-96Jqr_MovqmjRyoft1Fw";

function supabaseRequest($method, $endpoint, $payload = null) {
    global $SUPABASE_URL, $SUPABASE_KEY;
    $url = $SUPABASE_URL . "/rest/v1/" . $endpoint;
    
    $headers = [
        "apikey: " . $SUPABASE_KEY,
        "Authorization: Bearer " . $SUPABASE_KEY,
        "Content-Type: application/json",
        "Prefer: return=representation"
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($payload) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return ['code' => $httpCode, 'data' => json_decode($response, true)];
}

// ── Helpers ──────────────────────────────────────────────────
function sanitize(string $value): string {
    return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
}

function validateEmail(string $email): bool {
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

$action = trim($_POST['action'] ?? '');

// ── Booking ──────────────────────────────────────────────────
if ($action === 'booking') {
    $vehicleId   = sanitize($_POST['vehicleId']   ?? '');
    $vehicleName = sanitize($_POST['vehicleName'] ?? '');
    $date        = sanitize($_POST['date']        ?? '');
    $time        = sanitize($_POST['time']        ?? '');
    $fullName    = sanitize($_POST['fullName']    ?? '');
    $email       = sanitize($_POST['email']       ?? '');
    $phone       = sanitize($_POST['phone']       ?? '');
    $address     = sanitize($_POST['address']     ?? '');

    if (!$vehicleId || !$date || !$time || !$fullName || !$email || !$phone || !$address) {
        echo json_encode(['success' => false, 'message' => 'All fields are required']); exit;
    }
    if (!validateEmail($email)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address']); exit;
    }
    
    $bookingDate = strtotime($date);
    if ($bookingDate === false || $bookingDate < strtotime('today')) {
        echo json_encode(['success' => false, 'message' => 'Please select a future date']); exit;
    }
    $phoneDigits = preg_replace('/[\s\-().+]/', '', $phone);
    if (!preg_match('/^\d{7,15}$/', $phoneDigits)) {
        echo json_encode(['success' => false, 'message' => 'Invalid phone number']); exit;
    }

    // 1. Check if client exists (by phone)
    $clientsRes = supabaseRequest("GET", "clients?phone=eq." . urlencode($phone) . "&select=*");
    
    $clientId = null;
    if ($clientsRes['code'] == 200 && is_array($clientsRes['data']) && count($clientsRes['data']) > 0) {
        // Update existing client
        $clientId = $clientsRes['data'][0]['id'];
        supabaseRequest("PATCH", "clients?id=eq." . $clientId, [
            "name" => $fullName,
            "email" => $email
        ]);
    } else {
        // Insert new client
        $insertRes = supabaseRequest("POST", "clients", [
            "name" => $fullName,
            "email" => $email,
            "phone" => $phone,
            "client_type" => "Individual",
            "company_name" => "Website Booking"
        ]);
        if ($insertRes['code'] == 201 && is_array($insertRes['data']) && count($insertRes['data']) > 0) {
            $clientId = $insertRes['data'][0]['id'];
        }
    }

    if (!$clientId) {
        echo json_encode(['success' => false, 'message' => 'Failed to process client information']); exit;
    }

    // 2. Insert into trips
    $tripNumber = "TRP-WEB-" . time();
    $dateTime = $date . 'T' . $time . ':00'; // ISO-like format
    
    $tripRes = supabaseRequest("POST", "trips", [
        "trip_number" => $tripNumber,
        "client_id" => $clientId,
        "vehicle_id" => is_numeric($vehicleId) ? (int)$vehicleId : $vehicleId,
        "pickup_location" => "HQ / Web Booking",
        "delivery_location" => $address,
        "pickup_time" => $dateTime,
        "cargo" => "Website Booking: " . $vehicleName,
        "status" => "scheduled",
        "trip_type" => "Delivery"
    ]);

    if ($tripRes['code'] == 201) {
        $bookingId = $tripRes['data'][0]['id'] ?? 0;
        echo json_encode(['success' => true, 'message' => "Booking confirmed for $vehicleName!", 'bookingId' => $bookingId]);
    } else {
        error_log('[JRR Supabase Error] ' . json_encode($tripRes));
        echo json_encode(['success' => false, 'message' => 'A database error occurred while creating your trip.']);
    }
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Unknown action']);