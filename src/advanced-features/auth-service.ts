export class AuthService { async authenticate(user: string, pass: string) { return user.length > 0 && pass.length > 8; } async authorize(token: string) { return token.length > 10; } }
export default AuthService;
