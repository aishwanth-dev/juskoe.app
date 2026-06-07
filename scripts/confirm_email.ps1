
$SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycm9tZWd3aGhreWpzZnh2ZXN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMzU0MiwiZXhwIjoyMDg2Nzk5NTQyfQ.JoHsQsbskTLxkaQOF9d8GiRwcN9uGTCqOhRDngY9Bo8'
$SUPABASE_URL = 'https://rrromegwhhkyjsfxvesu.supabase.co'
$userId       = 'aaaa01b6-120f-4eb6-bbd6-684473f2a341'

$headers = @{
    'apikey'        = $SERVICE_KEY
    'Authorization' = "Bearer $SERVICE_KEY"
    'Content-Type'  = 'application/json'
}

# Confirm email via Admin API (PUT /auth/v1/admin/users/{id})
Write-Host "[1] Confirming email for prouser@juskoe.in ..."
$body = '{"email_confirm":true}'

$r = Invoke-WebRequest `
    -Uri "$SUPABASE_URL/auth/v1/admin/users/$userId" `
    -Method PUT `
    -Headers $headers `
    -Body $body `
    -UseBasicParsing

Write-Host "[1] Status: $($r.StatusCode)"
$data = $r.Content | ConvertFrom-Json
Write-Host "    email              : $($data.email)"
Write-Host "    email_confirmed_at : $($data.email_confirmed_at)"
Write-Host "    confirmed_at       : $($data.confirmed_at)"
Write-Host ""
Write-Host "Done! prouser@juskoe.in email is confirmed."
