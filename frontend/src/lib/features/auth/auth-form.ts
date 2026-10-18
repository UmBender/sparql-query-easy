/**
 * Login and registration forms (AUTH-003): the Zod schemas Superforms checks
 * before a request. Registration repeats the server's rules (Authentication
 * Contract, AUTH-001); login only requires both fields, so a failure never
 * hints at which accounts exist.
 */
import { z } from 'zod';

export const USERNAME_RULE = "3 to 32 letters, digits, '.', '_' or '-'";
export const PASSWORD_RULE = '8 to 128 characters';

export const loginSchema = z.object({
	username: z.string().trim().min(1, 'Enter your username.'),
	password: z.string().min(1, 'Enter your password.')
});

export const registerSchema = z
	.object({
		username: z
			.string()
			.trim()
			.min(3, `Use ${USERNAME_RULE}.`)
			.max(32, `Use ${USERNAME_RULE}.`)
			.regex(/^[A-Za-z0-9._-]+$/, `Use ${USERNAME_RULE}.`),
		password: z.string().min(8, `Use ${PASSWORD_RULE}.`).max(128, `Use ${PASSWORD_RULE}.`),
		confirm: z.string()
	})
	// There is no password recovery, so a typo would lock the account.
	.refine((form) => form.confirm === form.password, {
		message: 'The passwords do not match.',
		path: ['confirm']
	});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
