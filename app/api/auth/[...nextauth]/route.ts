import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import axios, { AxiosError } from "axios";

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Please provide both email and password");
                }

                try {
                    const response = await axios.post(
                        `${process.env.NEXT_PUBLIC_STRAPI_URL}/api/auth/local`,
                        {
                            identifier: credentials.email,
                            password: credentials.password,
                        },
                        {
                            headers: {
                                Accept: 'application/json',
                                'Content-Type': 'application/json',
                            },
                            withCredentials: true
                        }
                    );

                    const data = response.data;

                    if (data.jwt && data.user) {
                        return {
                            id: data.user.id.toString(),
                            name: data.user.username,
                            email: data.user.email,
                            jwt: data.jwt,
                        };
                    }

                    throw new Error("Invalid credentials");
                } catch (error) {
                    if (axios.isAxiosError(error)) {
                        console.error('Login error response:', error.response?.data);
                        if (error.response?.status === 400) {
                            throw new Error("Invalid identifier or password");
                        }
                        throw new Error(error.response?.data?.error?.message || "Authentication failed");
                    }
                    console.error("Authentication error:", error);
                    throw new Error("An error occurred during authentication");
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.jwt = user.jwt;
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && token.id) {
                session.jwt = token.jwt;
                session.user.id = token.id;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
        error: '/login'
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    debug: process.env.NODE_ENV === 'development',
})

export { handler as GET, handler as POST }