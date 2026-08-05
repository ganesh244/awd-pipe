import fetch from 'node-fetch';

async function run() {
  const loginRes = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();

  const postRes = await fetch('http://localhost:3000/api/hierarchy/districts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginData.token}` },
    body: JSON.stringify({ id: 'dist-test-123', name: 'Test District', stateId: 'st-1' })
  });
  const postData = await postRes.text();
  console.log("Post response:", postRes.status, postData);
}
run();
