import bcrypt from 'bcryptjs'; // pure-JS implementation of the bcrypt algorithm (no native build step)
export const hashPassword = (pw) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);
