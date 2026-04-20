const { complaints, tasksByStaffPhone, usersByPhone } = require("./mockData");

const sessions = new Map();

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { step: null, draft: {} });
  }
  return sessions.get(phone);
}

function resetSession(phone) {
  sessions.set(phone, { step: null, draft: {} });
}

function getMenu(role) {
  if (role === "resident") {
    return "Resident Menu:\n1) New complaint\n2) My complaints\nType a number.";
  }
  if (role === "staff") {
    return "Staff Menu:\n1) My tasks\n2) Mark task done\nType a number.";
  }
  if (role === "supervisor") {
    return "Supervisor Menu:\n1) View pending complaints\n2) Assign complaint\nType a number.";
  }
  return "Admin Menu:\n1) View all complaints\n2) Escalate complaint\nType a number.";
}

function handleResident(phone, text, session) {
  const normalized = text.trim().toLowerCase();

  if (session.step === "resident_waiting_category") {
    session.draft.category = normalized;
    session.step = "resident_waiting_description";
    return "Send complaint description (e.g. 'No sanitizer in H2 south wing').";
  }

  if (session.step === "resident_waiting_description") {
    const newId = `C-${1000 + complaints.length + 1}`;
    complaints.push({
      id: newId,
      residentPhone: phone,
      category: session.draft.category || "general",
      description: text.trim(),
      status: "pending",
      assignedTo: null,
      createdAt: new Date().toISOString()
    });
    resetSession(phone);
    return `Complaint ${newId} created successfully. Type 'menu' for more.`;
  }

  if (normalized === "1") {
    session.step = "resident_waiting_category";
    return "Enter complaint category (hygiene/cleaning/plumbing/false_reporting).";
  }

  if (normalized === "2") {
    const mine = complaints.filter((c) => c.residentPhone === phone);
    if (!mine.length) {
      return "You have no complaints yet.";
    }
    return mine
      .map((c) => `${c.id} | ${c.category} | ${c.status}`)
      .join("\n");
  }

  return "Type 'menu' to see options.";
}

function handleStaff(phone, text) {
  const normalized = text.trim().toLowerCase();
  const tasks = tasksByStaffPhone[phone] || [];

  if (normalized === "1") {
    if (!tasks.length) {
      return "No tasks assigned.";
    }
    return tasks.map((t) => `${t.id} | ${t.title} | ${t.status}`).join("\n");
  }

  if (normalized.startsWith("2 ")) {
    const taskId = text.split(" ")[1];
    const task = tasks.find((t) => t.id.toLowerCase() === String(taskId).toLowerCase());
    if (!task) {
      return "Task not found. Use: 2 T-2001";
    }
    task.status = "completed";
    return `Task ${task.id} marked completed.`;
  }

  if (normalized === "2") {
    return "Send: 2 <TASK_ID>\nExample: 2 T-2001";
  }

  return "Type 'menu' to see options.";
}

function handleSupervisor(text) {
  const normalized = text.trim().toLowerCase();

  if (normalized === "1") {
    const pending = complaints.filter((c) => c.status === "pending");
    if (!pending.length) {
      return "No pending complaints.";
    }
    return pending
      .map((c) => `${c.id} | ${c.category} | assigned: ${c.assignedTo || "none"}`)
      .join("\n");
  }

  if (normalized.startsWith("2 ")) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 3) {
      return "Use: 2 <COMPLAINT_ID> <STAFF_PHONE>";
    }
    const complaintId = parts[1];
    const staffPhone = parts[2];
    const complaint = complaints.find((c) => c.id.toLowerCase() === complaintId.toLowerCase());
    const staffUser = usersByPhone[staffPhone];

    if (!complaint) {
      return "Complaint not found.";
    }
    if (!staffUser || staffUser.role !== "staff") {
      return "Invalid staff phone.";
    }

    complaint.assignedTo = staffUser.name;
    complaint.status = "in-progress";
    return `Complaint ${complaint.id} assigned to ${staffUser.name}.`;
  }

  if (normalized === "2") {
    return "Send: 2 <COMPLAINT_ID> <STAFF_PHONE>\nExample: 2 C-1001 +911000000003";
  }

  return "Type 'menu' to see options.";
}

function handleAdmin(text) {
  const normalized = text.trim().toLowerCase();

  if (normalized === "1") {
    if (!complaints.length) {
      return "No complaints in system.";
    }
    return complaints.map((c) => `${c.id} | ${c.category} | ${c.status}`).join("\n");
  }

  if (normalized.startsWith("2 ")) {
    const complaintId = text.trim().split(/\s+/)[1];
    const complaint = complaints.find((c) => c.id.toLowerCase() === String(complaintId).toLowerCase());
    if (!complaint) {
      return "Complaint not found.";
    }
    complaint.status = "escalated";
    return `Complaint ${complaint.id} escalated to supervisors.`;
  }

  if (normalized === "2") {
    return "Send: 2 <COMPLAINT_ID>\nExample: 2 C-1001";
  }

  return "Type 'menu' to see options.";
}

function processMessage(phone, text) {
  const user = usersByPhone[phone];
  if (!user) {
    return {
      ok: true,
      response:
        "Phone not linked yet. For demo, use one of:\n+911000000001 (admin)\n+911000000002 (supervisor)\n+911000000003 (staff)\n+911000000004 (resident)"
    };
  }

  const session = getSession(phone);
  const normalized = text.trim().toLowerCase();

  if (normalized === "hi" || normalized === "hello" || normalized === "start" || normalized === "menu") {
    return {
      ok: true,
      response: `Hi ${user.name} (${user.role}).\n${getMenu(user.role)}`
    };
  }

  let response;
  if (user.role === "resident") response = handleResident(phone, text, session);
  else if (user.role === "staff") response = handleStaff(phone, text);
  else if (user.role === "supervisor") response = handleSupervisor(text);
  else response = handleAdmin(text);

  return { ok: true, response };
}

module.exports = {
  processMessage,
  sessions
};
