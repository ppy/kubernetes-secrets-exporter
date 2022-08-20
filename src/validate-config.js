let secrets = process.env['secrets.json'];
if(!secrets)
  throw new Error('Missing secrets.json environment variable');

try {
  secrets = JSON.parse(secrets);
} catch(err) {
  throw new Error(`Couldn't parse secrets.json environment variable: ${err.message}`);
}

if(typeof secrets !== 'object' || Array.isArray(secrets))
  throw new Error('Secrets definition is invalid');

for(const [secretName, secretDefinition] of Object.entries(secrets)) {
  if(typeof secretDefinition !== 'object' || Array.isArray(secretDefinition))
    throw new Error(`Secret definition for ${secretName} is invalid`);
  if(!Array.isArray(secretDefinition.allowedSubjectNames))
    throw new Error(`allowedSubjectNames definition for ${secretName} is invalid`);

  for(const client of secretDefinition.allowedSubjectNames)
    if(typeof client !== 'string')
      throw new Error(`allowedSubjectNames definition for ${secretName} has invalid values`);
}
