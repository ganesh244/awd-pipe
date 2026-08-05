import fetch from 'node-fetch';
async function run() {
  const loginRes = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();

  const postRes = await fetch('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginData.token}` },
    body: JSON.stringify({ newUser: { id: 'usr-test-123', username: 'testuser', role: 'CF', password: 'password123' } })
  });
  const postData = await postRes.text();
  console.log("Post user response:", postRes.status, postData);
}
run();
