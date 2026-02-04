import NextAuth from "next-auth";

declare module "next-auth" {
    interface Session {
        jwt?: string;
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
    }

    interface User {
        id: string;
        jwt?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        jwt?: string;
        id?: string;
    }
}