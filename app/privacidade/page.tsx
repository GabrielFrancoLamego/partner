import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Política de Privacidade — Tribuss" }

const sections: { title: string; body: string[] }[] = [
  {
    title: "1. Quem somos",
    body: [
      "A Tribuss é a plataforma de gestão de equipes, gamificação e programa de parceiros usada pelos estabelecimentos que a contratam (como Nomad's Jeri, Nomad's Lagoa e IN-ON). O estabelecimento é o controlador dos dados dos seus colaboradores e a Tribuss atua como operadora da plataforma; para parceiros, a Tribuss e o estabelecimento tratam os dados necessários ao programa de indicações.",
    ],
  },
  {
    title: "2. Quais dados coletamos",
    body: [
      "Cadastro: nome, e-mail, telefone/WhatsApp e foto de perfil.",
      "Dados para pagamento (colaboradores e parceiros): CPF, endereço, chave PIX e dados bancários, usados apenas para efetuar pagamentos, saques e comissões.",
      "Localização: a posição GPS é lida somente no momento em que o colaborador registra o ponto digital, para validar que ele está no estabelecimento. Não rastreamos a localização em segundo plano.",
      "Conteúdo operacional: fotos de checklists, comandas e comprovantes de pagamento, ocorrências, pontuação, metas e extrato financeiro.",
      "Clientes indicados: nome e contato (e-mail ou telefone), informados pelo parceiro, apenas para emitir o voucher e confirmar o benefício.",
    ],
  },
  {
    title: "3. Para que usamos",
    body: [
      "Operar a plataforma (ponto, checklists, pontuação, ocorrências, metas, folha e pagamentos), calcular e pagar comissões, enviar notificações do serviço, prevenir fraudes e cumprir obrigações legais. Não vendemos seus dados.",
    ],
  },
  {
    title: "4. Compartilhamento",
    body: [
      "Os dados são acessados pela gestão do seu estabelecimento conforme o perfil de acesso (Master, Gerente, Financeiro). Colaboradores veem apenas as próprias informações; no ranking aparece somente o pódio com o primeiro nome. Usamos provedores de infraestrutura (hospedagem, banco de dados, armazenamento de arquivos e envio de e-mail) que tratam os dados em nosso nome.",
    ],
  },
  {
    title: "5. Seus direitos (LGPD)",
    body: [
      "Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade e exclusão dos seus dados.",
      "Exclusão de conta: abra Perfil > \"Solicitar exclusão de conta\" dentro do aplicativo. O pedido é analisado pela gestão/administração e a conta é encerrada; registros financeiros e fiscais podem ser mantidos pelo prazo exigido em lei.",
    ],
  },
  {
    title: "6. Segurança e retenção",
    body: [
      "Os acessos são protegidos por autenticação (com verificação em duas etapas opcional) e controle de permissões por perfil. Mantemos os dados enquanto a conta estiver ativa e pelos prazos legais aplicáveis.",
    ],
  },
  {
    title: "7. Contato",
    body: ["Dúvidas ou pedidos sobre privacidade: use o canal Ajuda dentro do aplicativo ou fale com a gestão do seu estabelecimento."],
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F7F5F2] px-4 py-8 overflow-x-hidden">
      <article className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-md border border-gray-100 space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-[#3E2415]">Política de Privacidade</h1>
          <p className="text-xs text-gray-400 mt-1">Última atualização: outubro de 2026</p>
        </header>
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-base font-semibold text-[#3E2415]">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-gray-700">
                {p}
              </p>
            ))}
          </section>
        ))}
        <p className="text-sm">
          <Link href="/termos" className="font-medium text-[#F58220] hover:underline">
            Ver Termos de Uso
          </Link>
        </p>
      </article>
    </main>
  )
}
