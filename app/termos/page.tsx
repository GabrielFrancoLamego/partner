import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Termos de Uso — Tribuss" }

const sections: { title: string; body: string }[] = [
  { title: "1. Aceite", body: "Ao acessar a plataforma Tribuss você concorda com estes termos e com a Política de Privacidade. O acesso é pessoal e intransferível." },
  { title: "2. Contas e perfis", body: "Cada pessoa usa o perfil que lhe foi concedido (Master, Gerente, Financeiro, Colaborador ou Parceiro). É proibido compartilhar senha ou usar a conta de outra pessoa. Atividades sensíveis (pagamentos, aprovações, ajustes) ficam registradas para auditoria." },
  { title: "3. Colaboradores", body: "O registro de ponto, as entregas de checklist e as ocorrências devem refletir a realidade. Informações falsas ou fraude em tarefas podem gerar penalidades de pontuação e medidas previstas pelo estabelecimento." },
  { title: "4. Parceiros e comissões", body: "Vouchers e indicações seguem as regras do Programa de Parceria de cada estabelecimento. A comissão só é creditada após a confirmação do consumo no estabelecimento e a aprovação do financeiro; saques são pagos mediante comprovante, no prazo informado na aprovação." },
  { title: "5. Pagamentos", body: "Valores, descontos e prazos exibidos na plataforma seguem os lançamentos registrados pelo estabelecimento. Divergências devem ser tratadas com a gestão, que pode ajustar lançamentos mediante registro de auditoria." },
  { title: "6. Uso adequado", body: "É vedado tentar acessar dados de outros usuários, burlar permissões, automatizar o acesso sem autorização ou usar a plataforma para fins ilícitos." },
  { title: "7. Encerramento", body: "Você pode solicitar a exclusão da conta em Perfil > \"Solicitar exclusão de conta\". O estabelecimento ou a Tribuss podem suspender contas em caso de descumprimento destes termos." },
  { title: "8. Alterações", body: "Estes termos podem ser atualizados; a continuidade de uso após a atualização significa concordância com a nova versão." },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F7F5F2] px-4 py-8 overflow-x-hidden">
      <article className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-md border border-gray-100 space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-[#3E2415]">Termos de Uso</h1>
          <p className="text-xs text-gray-400 mt-1">Última atualização: outubro de 2026</p>
        </header>
        {sections.map((s) => (
          <section key={s.title} className="space-y-1.5">
            <h2 className="text-base font-semibold text-[#3E2415]">{s.title}</h2>
            <p className="text-sm leading-relaxed text-gray-700">{s.body}</p>
          </section>
        ))}
        <p className="text-sm">
          <Link href="/privacidade" className="font-medium text-[#F58220] hover:underline">
            Ver Política de Privacidade
          </Link>
        </p>
      </article>
    </main>
  )
}
