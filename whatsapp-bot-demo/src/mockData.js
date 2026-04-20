const usersByPhone = {
  "+911000000001": { id: "u1", name: "Admin Manager", role: "admin", email: "admin@hostel.com" },
  "+911000000002": { id: "u2", name: "Meera Desai", role: "supervisor", email: "meera@hostel.com" },
  "+911000000003": { id: "u3", name: "Rajesh Kumar", role: "staff", email: "rajesh@hostel.com" },
  "+911000000004": { id: "u4", name: "Arjun Singh", role: "resident", email: "student1@hostel.com" }
};

const complaints = [
  {
    id: "C-1001",
    residentPhone: "+911000000004",
    category: "hygiene",
    description: "No soap in H1 floor 2 washroom.",
    status: "pending",
    assignedTo: null,
    createdAt: new Date().toISOString()
  }
];

const tasksByStaffPhone = {
  "+911000000003": [
    { id: "T-2001", title: "Restock tissue in H1-G", status: "pending" },
    { id: "T-2002", title: "Clean H1-2 washroom", status: "in-progress" }
  ]
};

module.exports = {
  usersByPhone,
  complaints,
  tasksByStaffPhone
};
