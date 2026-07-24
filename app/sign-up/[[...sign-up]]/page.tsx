import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  )
}
