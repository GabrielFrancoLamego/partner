import { PartnerJoinForm } from "@/components/public/partner-join-form"

/** Variante com o código do afiliado no path — equivalente a /join/partner?ref=CODIGO, mas com URL mais fácil de compartilhar. */
export default async function PartnerJoinByAffiliatePage({ params }: { params: Promise<{ affiliateCode: string }> }) {
  const { affiliateCode } = await params
  return <PartnerJoinForm refCode={affiliateCode} />
}
