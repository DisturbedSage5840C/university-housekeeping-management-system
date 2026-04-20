# ILGC Tracker WhatsApp Bot Demo

This is a standalone demo to test whether ILGC Tracker workflows can run in a WhatsApp-style chat bot.

## What this demo proves

- Role-based chat flows are possible (admin, supervisor, staff, resident)
- Complaint creation and status tracking can work in chat
- Supervisor assignment and staff task handling can work in chat
- A webhook-style integration is possible for real WhatsApp providers later

## Quick start

1. Install dependencies:

   npm install

2. Copy env file:

   cp .env.example .env

3. Start server:

   npm start

4. Test health:

   curl http://localhost:8090/health

## Simulate chat (no WhatsApp required)

Use `/simulate` endpoint:

curl -X POST http://localhost:8090/simulate \
  -H "Content-Type: application/json" \
  -d '{"from":"+911000000004","text":"menu"}'

### Demo phones

- +911000000001 -> admin
- +911000000002 -> supervisor
- +911000000003 -> staff
- +911000000004 -> resident

## Example flows

### Resident flow

1. Send `menu`
2. Send `1` (new complaint)
3. Send category, for example `hygiene`
4. Send description

### Supervisor flow

1. Send `menu`
2. Send `1` to view pending complaints
3. Send `2 C-1001 +911000000003` to assign

### Staff flow

1. Send `menu`
2. Send `1` to view tasks
3. Send `2 T-2001` to mark a task completed

### Admin flow

1. Send `menu`
2. Send `1` to list all complaints
3. Send `2 C-1001` to escalate

## Optional: webhook testing shape

- `GET /webhook` supports Meta verification query format
- `POST /webhook` accepts a simplified Meta message payload and returns the bot response as JSON

This demo is intentionally minimal and in-memory to validate feasibility quickly.
