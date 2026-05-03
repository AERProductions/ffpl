import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:8090';

async function seed() {
  console.log('Authenticating as admin...');
  let token = '';

  try {
    const res = await fetch(BASE_URL + '/api/admins/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'copilot@vscode.com', password: 'testingtesting1234' })
    });
    const authData = await res.json();
    if (!authData.token) {
       console.error('Failed to auth:', authData);
       return;
    }
    token = authData.token;
    console.log('Authenticated successfully!');
  } catch (err) {
    console.error('Authentication failed:', err.message);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token
  };

  console.log('Checking/Creating Master Team...');
  let masterTeamId = null;
  const searchRes = await fetch(BASE_URL + '/api/collections/teams/records?filter=(name=\'Imported Stable\')', { headers });
  const searchData = await searchRes.json();

  if (searchData.items && searchData.items.length > 0) {
    masterTeamId = searchData.items[0].id;
    console.log('Master team already exists. ID:', masterTeamId);
  } else {
    const createRes = await fetch(BASE_URL + '/api/collections/teams/records', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Imported Stable',
        rank: 1,
        wins: 0,
        losses: 0
      })
    });
    const createData = await createRes.json();
    if (createData.id) {
      masterTeamId = createData.id;
      console.log('Created Master Team. ID:', masterTeamId);
    } else {
      console.error('Failed to create Master Team:', createData);
      return;
    }
  }

  const dataPath = path.join(process.cwd(), '../data/team_stable.json');
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const parsed = JSON.parse(rawData);

  console.log('Seeding AC Loadouts...');
  if (parsed.team && Array.isArray(parsed.team)) {
    for (const ac of parsed.team) {
      try {
        const payload = {
          ac_name: ac.ac_name || 'UNKNOWN',
          team: masterTeamId,
          base_traits: ac.ai_performance || {},
          parts_equipped: ac.hardware || {},
          ops_chips: ac.operations_grid || [],
          tamper_hash: ac.ram_offset
        };

        const insertRes = await fetch(BASE_URL + '/api/collections/ac_loadouts/records', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        const insertData = await insertRes.json();
        
        if (insertData.id) {
          console.log('Imported AC: ' + ac.ac_name);
        } else {
          console.error('Failed to import ' + ac.ac_name + ':', insertData);
        }

      } catch (insertErr) {
        console.error('Fetch error importing ' + ac.ac_name, insertErr.message);
      }
    }
  }

  console.log('Database successfully seeded!');
}

seed();
