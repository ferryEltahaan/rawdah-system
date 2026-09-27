import urllib.request
import json
import ssl

BASE_URL = "https://aeuavoqhrhzsxblrddlc.supabase.co/rest/v1"
HEADERS = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWF2b3Focmh6c3hibHJkZGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM2MDY1MywiZXhwIjoyMTA1OTM2NjUzfQ.l3yyAef3pJIIGpJS_4zHfLeTINm_-QYYLyHSQNgYvxI",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWF2b3Focmh6c3hibHJkZGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM2MDY1MywiZXhwIjoyMTA1OTM2NjUzfQ.l3yyAef3pJIIGpJS_4zHfLeTINm_-QYYLyHSQNgYvxI",
    "Content-Type": "application/json"
}

def test_supabase_profiles_endpoint():
    ctx = ssl.create_default_context()
    req = urllib.request.Request(f"{BASE_URL}/profiles?select=*", headers=HEADERS, method="GET")
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        assert resp.status == 200, f"Expected 200 but got {resp.status}"
        body = resp.read().decode('utf-8')
        data = json.loads(body)
        assert isinstance(data, list), f"Expected list response, got {type(data)}"
        assert len(data) > 0, "Expected at least 1 profile in the database"
        assert "username" in data[0], "Profile should contain username field"
        print(f"Verified {len(data)} profiles successfully from Supabase.")

if __name__ == "__main__":
    test_supabase_profiles_endpoint()
    print("Backend test passed successfully.")
