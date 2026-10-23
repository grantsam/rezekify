import { execSync } from 'child_process';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ponytail: regex email check and single-quote escaping; upgrade to parameterized psql via stdin if arbitrary identities are required.
export function purgeUserByEmail(email: string, containerName = 'rezekify_db'): boolean {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }
  const sanitizedEmail = email.replace(/'/g, "''").trim();
  try {
    execSync(
      `docker exec ${containerName} psql -U postgres -d rezekify -c "DELETE FROM users WHERE email = '${sanitizedEmail}';"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch {
    return false;
  }
}

export function checkUserExists(email: string, containerName = 'rezekify_db'): boolean {
  if (!email || !EMAIL_REGEX.test(email)) {
    return false;
  }
  const sanitizedEmail = email.replace(/'/g, "''").trim();
  try {
    const output = execSync(
      `docker exec ${containerName} psql -U postgres -d rezekify -t -A -c "SELECT COUNT(*) FROM users WHERE email = '${sanitizedEmail}';"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const count = parseInt(output.trim(), 10);
    return !isNaN(count) && count > 0;
  } catch {
    return false;
  }
}
