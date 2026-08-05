import fetch from 'node-fetch';

async function run() {
  const loginRes = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();

  const initRes = await fetch('http://localhost:3000/api/init', {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  const initData = await initRes.json();
  console.log("Districts count:", initData.districts.length);
  const testDist = initData.districts.find(d => d.id === 'dist-test-123');
  console.log("Found test district:", !!testDist);
}
run();
