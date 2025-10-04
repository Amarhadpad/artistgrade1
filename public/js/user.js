// public/js/users.js

document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("userTableBody");

  try {
    const res = await fetch("/api/users");  // API endpoint to get all users
    const users = await res.json();

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">No users found</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(user => {
      return `
        <tr>
          <td>${user._id}</td>
          <td>${user.fullname}</td>
          <td>${user.email}</td>
          <td>${new Date(user.createdAt).toLocaleDateString()}</td>
          <td>${user.role || 'User'}</td>
          <td>${user.isActive ? 'Active' : 'Inactive'}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editUser('${user._id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUser('${user._id}')">Delete</button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Error fetching users:", err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load users</td></tr>`;
  }
});

// Function to delete a user
async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  try {
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    const result = await res.json();
    alert(result.message);
    if (res.ok) location.reload();
  } catch (err) {
    console.error("Error deleting user:", err);
    alert("Failed to delete user");
  }
}

// Placeholder for edit functionality
function editUser(userId) {
  alert("Edit functionality coming soon for user: " + userId);
}
