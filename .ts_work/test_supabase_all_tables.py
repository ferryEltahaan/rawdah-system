import urllib.request
import json
import ssl
import sys

BASE_URL = "https://aeuavoqhrhzsxblrddlc.supabase.co/rest/v1"

# TestSprite injects __AUTH_HEADERS__ if defined, otherwise fallback
try:
    HEADERS = dict(__AUTH_HEADERS__)
except NameError:
    HEADERS = {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWF2b3Focmh6c3hibHJkZGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM2MDY1MywiZXhwIjoyMTA1OTM2NjUzfQ.l3yyAef3pJIIGpJS_4zHfLeTINm_-QYYLyHSQNgYvxI",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWF2b3Focmh6c3hibHJkZGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM2MDY1MywiZXhwIjoyMTA1OTM2NjUzfQ.l3yyAef3pJIIGpJS_4zHfLeTINm_-QYYLyHSQNgYvxI"
    }

# Also ensure apikey is always set for Supabase PostgREST
if "apikey" not in HEADERS:
    HEADERS["apikey"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWF2b3Focmh6c3hibHJkZGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM2MDY1MywiZXhwIjoyMTA1OTM2NjUzfQ.l3yyAef3pJIIGpJS_4zHfLeTINm_-QYYLyHSQNgYvxI"

HEADERS["Content-Type"] = "application/json"

def fetch_table(table_name):
    ctx = ssl.create_default_context()
    req = urllib.request.Request(f"{BASE_URL}/{table_name}?select=*", headers=HEADERS, method="GET")
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        assert resp.status == 200, f"Table {table_name} returned status {resp.status}"
        data = json.loads(resp.read().decode('utf-8'))
        assert isinstance(data, list), f"Expected list response for {table_name}"
        return data

def test_supabase_tables_schema_and_records():
    tables = [
        ("profiles", ["id", "username", "role", "is_active"]),
        ("customers", ["id", "full_name", "whatsapp_number"]),
        ("permits", ["id", "permit_code", "slot_date", "slot_hour", "status"]),
        ("sales_orders", ["id", "customer_id", "total_amount", "paid_amount"]),
        ("financial_accounts", ["id", "account_name", "provider", "current_balance"]),
        ("sms_messages", ["id", "sender", "raw_body", "status"]),
        ("audit_logs", ["id", "user_id", "action_type"]),
    ]
    
    for table_name, required_cols in tables:
        rows = fetch_table(table_name)
        print(f"[OK] Table '{table_name}' verified: {len(rows)} rows returned.")
        if len(rows) > 0:
            for col in required_cols:
                assert col in rows[0], f"Expected column '{col}' in table '{table_name}'"

if __name__ == "__main__":
    test_supabase_tables_schema_and_records()
    print("All Supabase backend tables and schemas verified successfully.")
