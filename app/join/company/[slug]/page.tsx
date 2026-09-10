import { prisma } from "@/lib/prisma"
import { CompanyJoinForm } from "@/components/public/company-join-form"

export default async function CompanyJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { slug } = await params
  const { token } = await searchParams
  const company = await prisma.company.findUnique({
    where: { slug },
    select: { name: true, status: true, logoWithLabelUrl: true, profilePictureUrl: true },
  })

  if (!company || company.status !== "ACTIVE") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center">
          <h1 className="text-lg font-bold text-[#3E2415]">Link inválido</h1>
          <p className="text-sm text-gray-600 mt-2">Este link de cadastro não existe ou não está mais ativo.</p>
        </div>
      </div>
    )
  }

  return (
    <CompanyJoinForm
      companyName={company.name}
      logoUrl={company.logoWithLabelUrl ?? company.profilePictureUrl}
      slug={slug}
      linkToken={token ?? null}
    />
  )
}
