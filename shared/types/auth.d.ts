declare module '#auth-utils' {
  interface User {
    avatarUrl: string
    email: string
    name: string
    personId: string
  }

  interface UserSession {
    loggedInAt: string
  }
}

export {}
