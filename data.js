window.DEMO_DATA = {
  "dates": [
    "2025-07-26",
    "2025-07-27",
    "2025-07-28",
    "2025-07-29",
    "2025-07-30",
    "2025-07-31",
    "2025-08-01",
    "2025-08-02",
    "2025-08-03",
    "2025-08-04",
    "2025-08-05",
    "2025-08-06",
    "2025-08-07",
    "2025-08-08"
  ],
  "calls_over_time": [
    117,
    73,
    63,
    74,
    139,
    98,
    107,
    62,
    124,
    101,
    123,
    64,
    114,
    116
  ],
  "ai_resolved": [
    74,
    44,
    44,
    41,
    87,
    68,
    66,
    45,
    71,
    67,
    91,
    43,
    81,
    63
  ],
  "human_escalated": [
    40,
    26,
    14,
    28,
    47,
    25,
    39,
    14,
    52,
    29,
    28,
    18,
    30,
    52
  ],
  "intents": [
    {
      "name": "Book Appointment",
      "rate": 42
    },
    {
      "name": "General Enquiry",
      "rate": 18
    },
    {
      "name": "Billing Question",
      "rate": 15
    },
    {
      "name": "Support Issue",
      "rate": 13
    },
    {
      "name": "Reschedule",
      "rate": 12
    }
  ],
  "recent_calls": [
    {
      "time": "09:15",
      "caller": "+44 7700 900123",
      "number": "020 7123 4567",
      "outcome": "Booked",
      "duration": "03:42",
      "sentiment": "Positive",
      "cost": 0.12
    },
    {
      "time": "09:10",
      "caller": "+44 7700 900987",
      "number": "020 7123 4567",
      "outcome": "Escalated",
      "duration": "05:12",
      "sentiment": "Neutral",
      "cost": 0.21
    },
    {
      "time": "08:56",
      "caller": "+1 212 555 0042",
      "number": "+1 212 555 9876",
      "outcome": "Message Taken",
      "duration": "02:18",
      "sentiment": "Positive",
      "cost": 0.08
    },
    {
      "time": "08:44",
      "caller": "+44 7700 900765",
      "number": "020 7123 4567",
      "outcome": "Missed",
      "duration": "00:00",
      "sentiment": "\u2014",
      "cost": 0.0
    }
  ],
  "sms_threads": [
    {
      "id": "t1",
      "caller": "+44 7700 900123",
      "preview": "Can you call me back?",
      "messages": [
        {
          "from": "AI",
          "text": "Hello, thanks for calling ExampleCo. How can I help?"
        },
        {
          "from": "Caller",
          "text": "Need to reschedule my appointment."
        },
        {
          "from": "AI",
          "text": "Sure, what time works best?"
        }
      ]
    },
    {
      "id": "t2",
      "caller": "+44 7700 900456",
      "preview": "Voicemail (0:42)",
      "messages": [
        {
          "from": "System",
          "text": "Voicemail transcription: \"Hi, I wanted to ask about pricing...\""
        }
      ]
    }
  ],
  "numbers": [
    {
      "number": "020 7123 4567",
      "country": "UK",
      "status": "Active",
      "routing": "AI Flow v2",
      "calls": 382
    },
    {
      "number": "+1 212 555 9876",
      "country": "US",
      "status": "Active",
      "routing": "After Hours \u2192 Voicemail",
      "calls": 174
    },
    {
      "number": "+353 1 234 5678",
      "country": "IE",
      "status": "Pending Port",
      "routing": "\u2014",
      "calls": 0
    }
  ],
  "invoices": [
    {
      "date": "01 Aug 2025",
      "amount": "\u00a3199.00",
      "status": "Paid"
    },
    {
      "date": "01 Jul 2025",
      "amount": "\u00a3199.00",
      "status": "Paid"
    },
    {
      "date": "01 Jun 2025",
      "amount": "\u00a3199.00",
      "status": "Paid"
    }
  ],
  "contacts": [
    {
      "name": "John Doe",
      "phone": "+44 7700 900123",
      "email": "john@example.com",
      "tags": "VIP",
      "last": "2 days ago"
    },
    {
      "name": "Sarah Lee",
      "phone": "+1 212 555 0042",
      "email": "sarah@acme.com",
      "tags": "Lead",
      "last": "Yesterday"
    },
    {
      "name": "Mohamed Ali",
      "phone": "+44 7700 900765",
      "email": "m.ali@contoso.co.uk",
      "tags": "Customer",
      "last": "Today"
    }
  ],
  "bookings": [
    {
      "when": "2025-08-10 10:00",
      "name": "John Doe",
      "type": "Consultation 30m",
      "status": "Confirmed"
    },
    {
      "when": "2025-08-11 14:30",
      "name": "Sarah Lee",
      "type": "Onboarding 60m",
      "status": "Pending"
    },
    {
      "when": "2025-08-12 09:00",
      "name": "Mohamed Ali",
      "type": "Support Call 30m",
      "status": "Rescheduled"
    }
  ],
  "qa": [
    {
      "id": "C-1024",
      "score": 92,
      "sentiment": "Positive",
      "notes": "Clear intent capture, correct booking."
    },
    {
      "id": "C-1025",
      "score": 74,
      "sentiment": "Neutral",
      "notes": "Missed follow-up SMS."
    },
    {
      "id": "C-1026",
      "score": 65,
      "sentiment": "Negative",
      "notes": "Escalated late; update fallback."
    }
  ],
  "usage": {
    "minutes": 4328,
    "minutes_limit": 5000,
    "numbers": 5,
    "numbers_limit": 7,
    "storage": 28,
    "storage_limit": 50
  }
};