
$SUPABASE_URL = 'https://rrromegwhhkyjsfxvesu.supabase.co'
$SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycm9tZWd3aGhreWpzZnh2ZXN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMzU0MiwiZXhwIjoyMDg2Nzk5NTQyfQ.JoHsQsbskTLxkaQOF9d8GiRwcN9uGTCqOhRDngY9Bo8'

$userId = 'aaaa01b6-120f-4eb6-bbd6-684473f2a341'

$headers = @{
    'apikey'        = $SERVICE_KEY
    'Authorization' = "Bearer $SERVICE_KEY"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'return=representation'
}

# ─── UPDATE profile: plan=pro, subscription_status=active ───────────────────
Write-Host "[1] Updating profile plan to 'pro' ..."
$updateBody = @{
    plan                = 'pro'
    subscription_status = 'active'
} | ConvertTo-Json

$resp = Invoke-WebRequest -Uri "$SUPABASE_URL/rest/v1/profiles?id=eq.$userId" `
    -Method PATCH -Headers $headers -Body $updateBody -UseBasicParsing

Write-Host "[1] Status: $($resp.StatusCode)"
Write-Host $resp.Content

# ─── VERIFY ──────────────────────────────────────────────────────────────────
Write-Host "`n[2] Verifying final state..."
$verResp = Invoke-WebRequest -Uri "$SUPABASE_URL/rest/v1/profiles?id=eq.$userId&select=id,email,plan,subscription_status" `
    -Method GET -Headers $headers -UseBasicParsing
Write-Host $verResp.Content

$subVerResp = Invoke-WebRequest -Uri "$SUPABASE_URL/rest/v1/subscriptions?user_id=eq.$userId&select=plan,status,current_period_end" `
    -Method GET -Headers $headers -UseBasicParsing
Write-Host $subVerResp.Content

Write-Host "`n============================================"
Write-Host " prouser@juskoe.in is now PRO FOREVER!"
Write-Host "============================================"
