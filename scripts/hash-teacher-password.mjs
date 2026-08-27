#!/usr/bin/env node
/**
 * Generates the scrypt verifier for TEACHER_VERIFICATION_PASSWORD_HASH.
 *
 * The password is read from the terminal with echo disabled and is never
 * written to disk, to argv (which is visible to other processes and to shell
 * history) or to any log. Only the verifier is printed. The verifier is safe to
 * paste into the Vercel dashboard: it is salted and deliberately slow to test,
 * so it cannot be turned back into the password the way the old unsalted
 * SHA-256 value could.
 *
 *   npm run teacher:hash
 */
import { createInterface } from 'node:readline';
import { buildScryptVerifier } from '../api/_lib/teacherVerification.js';

function prompt(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Run this in an interactive terminal so the password is not echoed.'));
      return;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Swallow the echo of every keystroke while the password is typed.
    const onWrite = (chunk, encoding, callback) => {
      if (rl.line !== undefined) process.stdout.write('', callback);
      else process.stdout.write(chunk, encoding, callback);
    };
    const originalWrite = rl.output.write.bind(rl.output);
    rl.output.write = onWrite;

    rl.question(question, (answer) => {
      rl.output.write = originalWrite;
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

const password = (await prompt('Teacher password (input hidden): ')).trim();

if (password.length < 12) {
  console.error('\nRefusing: use at least 12 characters. 16+ random characters is better.');
  process.exit(1);
}

const verifier = await buildScryptVerifier(password);

console.log('\nSet this as TEACHER_VERIFICATION_PASSWORD_HASH in Vercel:\n');
console.log(verifier);
console.log(
  '\nAfter it is saved and deployed, delete the old TEACHER_VERIFICATION_PASSWORD_SHA256 variable.'
);
console.log('Existing verified teachers keep their role; only future verification uses the new value.\n');
