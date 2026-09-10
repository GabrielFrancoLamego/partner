import { CompanySignupForm } from "@/components/public/company-signup-form"

export default async function CompanySignupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center">
          <h1 className="text-lg font-bold text-[#3E2415]">Link inválido</h1>
          <p className="text-sm text-gray-600 mt-2">Este cadastro exige um link de convite válido.</p>
        </div>
      </div>
    )
  }

  return <CompanySignupForm token={token} />
}
