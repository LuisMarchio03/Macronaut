import type { Cadeia, Equipamento, Regiao, TipoExercicio } from "../domain/types";

export interface GrupoSeed {
  nome: string;
  regiao: Regiao;
  cadeia: Cadeia | null;
}

/**
 * `cadeia` é NULL nos inferiores e no core de propósito: push/pull só é uma
 * divisão honesta no tronco. A análise de equilíbrio (Fase 3) mede só onde o
 * conceito existe.
 */
export const GRUPOS = [
  { nome: "Peito",       regiao: "superior", cadeia: "push" },
  { nome: "Costas",      regiao: "superior", cadeia: "pull" },
  { nome: "Ombros",      regiao: "superior", cadeia: "push" },
  { nome: "Bíceps",      regiao: "superior", cadeia: "pull" },
  { nome: "Tríceps",     regiao: "superior", cadeia: "push" },
  { nome: "Antebraço",   regiao: "superior", cadeia: "pull" },
  { nome: "Trapézio",    regiao: "superior", cadeia: "pull" },
  { nome: "Quadríceps",  regiao: "inferior", cadeia: null },
  { nome: "Posterior",   regiao: "inferior", cadeia: null },
  { nome: "Glúteos",     regiao: "inferior", cadeia: null },
  { nome: "Panturrilha", regiao: "inferior", cadeia: null },
  { nome: "Core",        regiao: "core",     cadeia: null },
] as const satisfies readonly GrupoSeed[];

export type NomeGrupo = (typeof GRUPOS)[number]["nome"];

export interface ItemCatalogo {
  nome: string;
  /** O grupo que faz o trabalho. É ele que a análise conta. */
  grupo: NomeGrupo;
  tipo: TipoExercicio;
  equipamento: Equipamento;
  /** Grupos que o movimento também recruta. Só desenho e ficha — não conta série. */
  secundarios?: readonly NomeGrupo[];
  /** Como você chama isto na academia. Alimenta a busca, não a tela. */
  aliases?: readonly string[];
  /** A execução, um passo por item. */
  instrucoes?: readonly string[];
  /**
   * Que fração do peso do corpo o movimento levanta. Flexão ≈ 0,64 (o resto
   * apoia nos pés), barra fixa = 1,00 (o corpo inteiro pendurado).
   *
   * É uma ESTIMATIVA de literatura, e serve a uma comparação relativa — "esta
   * semana movi mais que a passada" —, não a um número absoluto de fisiologia.
   * Só nos de peso corporal: em barra e máquina a carga é o dado.
   */
  fracao?: number;
  /**
   * MET do movimento, para a estimativa de caloria da calistenia. 8,0 é
   * "calisthenics, vigorous effort" do Compendium of Physical Activities;
   * 3,8 é a versão leve.
   *
   * Semear MET em exercício de peso corporal é seguro: cardio é reconhecido
   * por `equipamento === 'cardio'` (em `montarItemAvulso`) e por
   * `duracao_min IS NOT NULL` (em `ehCardio`), nunca pela presença de MET.
   */
  met?: number;
  /** 'segundos' nos isométricos. Ausente = repetições. */
  medida?: "segundos";
}

/**
 * Nomes de catálogo que mudaram: antigo → novo.
 *
 * O seed casa por NOME (`exercises` não tem chave natural melhor), então
 * renomear uma entrada aqui criaria uma linha nova e deixaria a antiga órfã
 * para sempre: duas entradas do mesmo movimento no autocomplete, e a rotina e
 * o histórico do usuário apontando para a que não recebe mais ficha nenhuma.
 *
 * Com o mapa, o seed RENOMEIA a linha existente — o id sobrevive, e com ele
 * `routine_exercises` e `workout_sets`.
 *
 * Só remova uma entrada daqui quando tiver certeza de que nenhum banco em uso
 * ainda tem o nome antigo.
 */
export const RENOMEADOS: Readonly<Record<string, string>> = {
  "Búlgaro com halteres": "Agachamento búlgaro com halteres",
};

/**
 * Catálogo global (`source='catalogo'`, `user_id` NULL). O tipo `NomeGrupo`
 * transforma um erro de digitação em `grupo` ou em `secundarios` num erro de
 * build, em vez de linha órfã no banco e músculo que não acende no desenho.
 *
 * As instruções são o essencial da execução, não um manual: o que posicionar,
 * o caminho da carga, e o erro que mais machuca. Quem quiser ver alguém
 * fazendo tem os links de execução na ficha — o app não tenta ser o vídeo.
 *
 * Os apelidos existem porque ninguém procura "Supino reto com barra" na
 * academia: procura "supino", ou "bench". Sem eles um catálogo grande é um
 * catálogo em que você não acha nada e cadastra de novo o que já existe.
 */
export const CATALOGO: readonly ItemCatalogo[] = [
  // ══ Peito ═══════════════════════════════════════════════════════════════
  {
    nome: "Supino reto com barra", grupo: "Peito", tipo: "composto", equipamento: "barra",
    secundarios: ["Tríceps", "Ombros"],
    aliases: ["supino", "bench", "bench press", "supino reto"],
    instrucoes: [
      "Deite no banco com os pés firmes no chão e as escápulas encaixadas para trás.",
      "Pegada pouco mais larga que os ombros; desça a barra até o meio do peito, cotovelos a cerca de 45°.",
      "Empurre até estender os cotovelos sem travar, mantendo os ombros para trás o tempo todo.",
    ],
  },
  {
    nome: "Supino inclinado com barra", grupo: "Peito", tipo: "composto", equipamento: "barra",
    secundarios: ["Ombros", "Tríceps"],
    aliases: ["inclinado", "supino inclinado", "incline bench"],
    instrucoes: [
      "Banco entre 30° e 45° — mais que isso e o exercício vira desenvolvimento de ombro.",
      "Desça a barra na linha da clavícula, não do meio do peito.",
      "Suba controlando; o cotovelo termina sob o punho, não à frente dele.",
    ],
  },
  {
    nome: "Supino declinado com barra", grupo: "Peito", tipo: "composto", equipamento: "barra",
    secundarios: ["Tríceps"],
    aliases: ["declinado", "supino declinado"],
    instrucoes: [
      "Prenda os pés no apoio antes de receber a barra.",
      "Desça até a parte baixa do peito, logo abaixo do mamilo.",
      "Empurre em linha reta; a amplitude é menor que no reto, e isso é esperado.",
    ],
  },
  {
    nome: "Supino reto com halteres", grupo: "Peito", tipo: "composto", equipamento: "halter",
    secundarios: ["Tríceps", "Ombros"],
    aliases: ["supino halteres", "supino com halter", "dumbbell press"],
    instrucoes: [
      "Suba os halteres com o impulso das coxas, deitando junto com o movimento.",
      "Desça até os halteres ficarem na altura do peito, sentindo o alongamento sem forçar o ombro.",
      "Junte na subida sem bater um no outro — bater tira a tensão do peito.",
    ],
  },
  {
    nome: "Supino inclinado com halteres", grupo: "Peito", tipo: "composto", equipamento: "halter",
    secundarios: ["Ombros", "Tríceps"],
    aliases: ["inclinado halteres", "incline dumbbell"],
    instrucoes: [
      "Banco em 30°–45°, halteres apoiados nas coxas antes de deitar.",
      "Desça na linha da parte alta do peito, punhos alinhados com os cotovelos.",
      "Suba num arco leve para dentro, sem deixar os halteres se afastarem do corpo.",
    ],
  },
  {
    nome: "Supino declinado com halteres", grupo: "Peito", tipo: "composto", equipamento: "halter",
    secundarios: ["Tríceps"],
    instrucoes: [
      "Prenda os pés e receba os halteres já deitado, com ajuda se possível.",
      "Desça até a parte baixa do peito e suba controlando a linha.",
    ],
  },
  {
    nome: "Supino na máquina", grupo: "Peito", tipo: "composto", equipamento: "maquina",
    secundarios: ["Tríceps", "Ombros"],
    aliases: ["chest press", "supino máquina"],
    instrucoes: [
      "Ajuste o banco para as pegadas ficarem na altura do meio do peito.",
      "Empurre sem travar o cotovelo e volte até sentir o peito alongar, sem bater o peso.",
    ],
  },
  {
    nome: "Supino no Smith", grupo: "Peito", tipo: "composto", equipamento: "maquina",
    secundarios: ["Tríceps", "Ombros"],
    aliases: ["smith", "supino smith"],
    instrucoes: [
      "Posicione o banco para a barra descer na linha do meio do peito.",
      "A trave guia o caminho — use isso para ir mais pesado com segurança, não para relaxar o tronco.",
    ],
  },
  {
    nome: "Crucifixo reto com halteres", grupo: "Peito", tipo: "isolado", equipamento: "halter",
    secundarios: ["Ombros"],
    aliases: ["crucifixo", "fly", "crucifixo reto"],
    instrucoes: [
      "Cotovelos levemente flexionados e TRAVADOS assim o movimento inteiro.",
      "Abra em arco até sentir o peito alongar na altura do ombro — não mais fundo.",
      "Feche pelo mesmo arco, imaginando abraçar um barril.",
    ],
  },
  {
    nome: "Crucifixo inclinado com halteres", grupo: "Peito", tipo: "isolado", equipamento: "halter",
    secundarios: ["Ombros"],
    aliases: ["crucifixo inclinado"],
    instrucoes: [
      "Banco em 30°; mesma trava de cotovelo do crucifixo reto.",
      "Abra até a linha do ombro e feche em arco, sem transformar em supino.",
    ],
  },
  {
    nome: "Crossover na polia", grupo: "Peito", tipo: "isolado", equipamento: "polia",
    secundarios: ["Ombros"],
    aliases: ["cross over", "crossover", "voador na polia"],
    instrucoes: [
      "Um pé à frente e tronco levemente inclinado, para o cabo não puxar você para trás.",
      "Traga as mãos à frente do corpo cruzando um pouco na frente, e segure meio segundo.",
      "Volte controlando; a tensão do cabo é constante, então não há ponto de descanso.",
    ],
  },
  {
    nome: "Peck deck", grupo: "Peito", tipo: "isolado", equipamento: "maquina",
    aliases: ["voador", "peck-deck", "voador máquina"],
    instrucoes: [
      "Ajuste o banco para as pegadas ficarem na altura do peito, não do ombro.",
      "Feche até quase encostar e volte só até sentir o alongamento, sem jogar o ombro à frente.",
    ],
  },
  {
    nome: "Crucifixo na máquina", grupo: "Peito", tipo: "isolado", equipamento: "maquina",
    secundarios: ["Ombros"],
    instrucoes: [
      "Costas apoiadas e cotovelos na linha do peito.",
      "Feche com o peito, não com a mão: a força sai do cotovelo empurrando para dentro.",
    ],
  },
  {
    nome: "Flexão de braço", grupo: "Peito", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.64, met: 8,
    secundarios: ["Tríceps", "Core"],
    aliases: ["flexão", "push up", "flexao"],
    instrucoes: [
      "Mãos pouco mais largas que os ombros, corpo em linha reta do calcanhar à cabeça.",
      "Desça até o peito quase tocar o chão, cotovelos a 45° do tronco.",
      "Suba sem deixar o quadril afundar — o abdômen segura a linha o tempo todo.",
    ],
  },
  {
    nome: "Flexão inclinada", grupo: "Peito", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.55, met: 5.5,
    secundarios: ["Tríceps", "Ombros"],
    aliases: ["flexão no banco"],
    instrucoes: [
      "Mãos num banco ou barra alta: quanto mais alto o apoio, mais leve fica.",
      "Mesma linha de corpo da flexão no chão; é a versão para ainda não conseguir a completa.",
    ],
  },
  {
    nome: "Flexão diamante", grupo: "Peito", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.7, met: 8,
    secundarios: ["Tríceps"],
    aliases: ["diamante", "diamond push up"],
    instrucoes: [
      "Mãos juntas embaixo do peito formando um losango entre polegares e indicadores.",
      "Desça mantendo os cotovelos rentes ao corpo — é aqui que o tríceps entra pesado.",
    ],
  },
  {
    nome: "Paralelas", grupo: "Peito", tipo: "composto", equipamento: "peso_corporal",
    fracao: 1.0, met: 8,
    secundarios: ["Tríceps", "Ombros"],
    aliases: ["dips", "mergulho", "mergulho nas paralelas"],
    instrucoes: [
      "Incline o tronco à frente: em pé reto o exercício vira tríceps.",
      "Desça até o ombro ficar na linha do cotovelo, e não além — abaixo disso o ombro paga a conta.",
      "Suba empurrando as barras para baixo e para dentro.",
    ],
  },
  {
    nome: "Pullover com halter", grupo: "Peito", tipo: "composto", equipamento: "halter",
    secundarios: ["Costas", "Tríceps"],
    aliases: ["pullover"],
    instrucoes: [
      "Deitado no banco, segure um halter com as duas mãos acima do peito.",
      "Leve atrás da cabeça com os cotovelos quase estendidos, até sentir a caixa torácica abrir.",
      "Volte pelo mesmo caminho sem arquear a lombar.",
    ],
  },

  // ══ Costas ══════════════════════════════════════════════════════════════
  {
    nome: "Barra fixa pronada", grupo: "Costas", tipo: "composto", equipamento: "peso_corporal",
    fracao: 1.0, met: 8,
    secundarios: ["Bíceps", "Antebraço"],
    aliases: ["barra", "barra fixa", "pull up", "pullup"],
    instrucoes: [
      "Pegada pronada pouco mais larga que os ombros, corpo parado antes de puxar.",
      "Puxe levando o peito à barra e os cotovelos para baixo e para trás, não para os lados.",
      "Desça até estender os braços — meia amplitude aqui é meia costas.",
    ],
  },
  {
    nome: "Barra fixa supinada", grupo: "Costas", tipo: "composto", equipamento: "peso_corporal",
    fracao: 1.0, met: 8,
    secundarios: ["Bíceps"],
    aliases: ["chin up", "barra supinada"],
    instrucoes: [
      "Palmas voltadas para você, mãos na largura dos ombros.",
      "Puxe até o queixo passar a barra; o bíceps ajuda mais aqui, então costuma sair mais repetição.",
    ],
  },
  {
    nome: "Barra fixa neutra", grupo: "Costas", tipo: "composto", equipamento: "peso_corporal",
    fracao: 1.0, met: 8,
    secundarios: ["Bíceps", "Antebraço"],
    aliases: ["barra neutra", "pegada neutra"],
    instrucoes: [
      "Palmas de frente uma para a outra, no triângulo ou nas alças paralelas.",
      "É a pegada mais amiga do ombro e do cotovelo — boa quando a pronada incomoda.",
    ],
  },
  {
    nome: "Puxada frontal na polia", grupo: "Costas", tipo: "composto", equipamento: "polia",
    secundarios: ["Bíceps"],
    aliases: ["pulley", "puxada", "pulldown", "lat pulldown"],
    instrucoes: [
      "Trave as coxas no apoio e incline o tronco uns 15° para trás.",
      "Puxe a barra até a parte alta do peito, cotovelos descendo rente ao corpo.",
      "Suba controlando até o braço estender e o ombro subir junto.",
    ],
  },
  {
    nome: "Puxada supinada na polia", grupo: "Costas", tipo: "composto", equipamento: "polia",
    secundarios: ["Bíceps"],
    aliases: ["puxada supinada"],
    instrucoes: [
      "Pegada supinada na largura dos ombros.",
      "Puxe até o peito com os cotovelos rentes ao tronco; o bíceps entra mais que na pronada.",
    ],
  },
  {
    nome: "Puxada neutra na polia", grupo: "Costas", tipo: "composto", equipamento: "polia",
    secundarios: ["Bíceps"],
    aliases: ["triângulo", "puxada triangulo", "pegada neutra polia"],
    instrucoes: [
      "Use o triângulo ou a barra de pegada paralela.",
      "Puxe até o esterno, peito aberto, sem enrolar os ombros à frente.",
    ],
  },
  {
    nome: "Remada curvada com barra", grupo: "Costas", tipo: "composto", equipamento: "barra",
    secundarios: ["Bíceps", "Posterior", "Trapézio"],
    aliases: ["remada", "remada curvada", "barbell row"],
    instrucoes: [
      "Quadril para trás, tronco entre 45° e quase paralelo ao chão, coluna neutra.",
      "Puxe a barra ao umbigo, cotovelos junto ao corpo; a lombar não se mexe.",
      "Desça controlando — se precisar de impulso do tronco, o peso está alto demais.",
    ],
  },
  {
    nome: "Remada curvada supinada", grupo: "Costas", tipo: "composto", equipamento: "barra",
    secundarios: ["Bíceps"],
    aliases: ["remada supinada", "yates"],
    instrucoes: [
      "Pegada supinada na largura dos ombros, tronco a uns 45°.",
      "Puxe à altura do umbigo; a pegada põe mais dorsal baixa e bíceps no movimento.",
    ],
  },
  {
    nome: "Remada cavalinho", grupo: "Costas", tipo: "composto", equipamento: "barra",
    secundarios: ["Bíceps", "Trapézio"],
    aliases: ["cavalinho", "t-bar", "t bar row"],
    instrucoes: [
      "Peito no apoio quando houver; joelhos semiflexionados e lombar neutra quando não.",
      "Puxe o peso ao abdômen, apertando as escápulas no fim.",
    ],
  },
  {
    nome: "Remada unilateral com halter", grupo: "Costas", tipo: "composto", equipamento: "halter",
    secundarios: ["Bíceps"],
    aliases: ["serrote", "remada serrote", "one arm row"],
    instrucoes: [
      "Um joelho e uma mão no banco, coluna paralela ao chão.",
      "Puxe o halter à lateral do quadril, cotovelo rente ao tronco.",
      "Não gire o tronco para levantar mais peso — o ganho vira rotação, não costas.",
    ],
  },
  {
    nome: "Remada baixa na polia", grupo: "Costas", tipo: "composto", equipamento: "polia",
    secundarios: ["Bíceps", "Trapézio"],
    aliases: ["remada sentada", "remada baixa", "seated row"],
    instrucoes: [
      "Joelhos levemente flexionados, tronco na vertical.",
      "Puxe ao umbigo juntando as escápulas; volte deixando o ombro ir à frente, sem soltar o tronco.",
    ],
  },
  {
    nome: "Remada na máquina", grupo: "Costas", tipo: "composto", equipamento: "maquina",
    secundarios: ["Bíceps"],
    aliases: ["remada máquina"],
    instrucoes: [
      "Peito apoiado e banco ajustado para as pegadas ficarem na altura do abdômen.",
      "Puxe até as mãos passarem a linha do tronco e volte alongando.",
    ],
  },
  {
    nome: "Remada curvada com halteres", grupo: "Costas", tipo: "composto", equipamento: "halter",
    secundarios: ["Bíceps", "Posterior"],
    aliases: ["remada halteres"],
    instrucoes: [
      "Tronco inclinado, um halter em cada mão com pegada neutra.",
      "Puxe os dois ao mesmo tempo à altura do quadril, cotovelos rentes.",
    ],
  },
  {
    nome: "Pullover na polia", grupo: "Costas", tipo: "isolado", equipamento: "polia",
    secundarios: ["Tríceps"],
    aliases: ["pullover polia", "straight arm pulldown"],
    instrucoes: [
      "Em pé de frente para a polia alta, braços quase estendidos e travados.",
      "Empurre a barra até as coxas usando o dorsal, sem dobrar o cotovelo.",
    ],
  },
  {
    nome: "Remada australiana", grupo: "Costas", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.55, met: 5.5,
    secundarios: ["Bíceps", "Core"],
    aliases: ["australiana", "inverted row", "remada invertida"],
    instrucoes: [
      "Deite sob uma barra baixa e segure na largura dos ombros, corpo em linha reta.",
      "Puxe o peito até a barra; quanto mais horizontal o corpo, mais difícil.",
    ],
  },

  // ══ Ombros ══════════════════════════════════════════════════════════════
  {
    nome: "Desenvolvimento militar com barra", grupo: "Ombros", tipo: "composto", equipamento: "barra",
    secundarios: ["Tríceps", "Trapézio", "Core"],
    aliases: ["militar", "ohp", "overhead press", "desenvolvimento"],
    instrucoes: [
      "Barra na clavícula, pegada pouco mais larga que os ombros, glúteo e abdômen firmes.",
      "Empurre para cima passando a cabeça e traga a barra para a linha das orelhas no topo.",
      "Desça controlando até a clavícula — sem arquear a lombar para compensar.",
    ],
  },
  {
    nome: "Desenvolvimento com halteres", grupo: "Ombros", tipo: "composto", equipamento: "halter",
    secundarios: ["Tríceps"],
    aliases: ["desenvolvimento halteres", "shoulder press"],
    instrucoes: [
      "Halteres na altura das orelhas, cotovelos um pouco à frente do tronco.",
      "Suba num arco leve para dentro, sem bater os halteres no topo.",
      "Desça até os cotovelos passarem pouco abaixo dos ombros.",
    ],
  },
  {
    nome: "Desenvolvimento sentado com halteres", grupo: "Ombros", tipo: "composto", equipamento: "halter",
    secundarios: ["Tríceps"],
    aliases: ["desenvolvimento sentado"],
    instrucoes: [
      "Encosto quase na vertical, costas apoiadas o movimento inteiro.",
      "Mesma linha do desenvolvimento em pé, com menos ajuda do tronco — costuma sair menos peso.",
    ],
  },
  {
    nome: "Desenvolvimento Arnold", grupo: "Ombros", tipo: "composto", equipamento: "halter",
    secundarios: ["Tríceps", "Peito"],
    aliases: ["arnold", "arnold press"],
    instrucoes: [
      "Comece com as palmas voltadas para você, halteres à frente do rosto.",
      "Gire as mãos para fora enquanto sobe, terminando com as palmas à frente.",
      "Desça refazendo a rotação — a volta é parte do exercício, não pressa.",
    ],
  },
  {
    nome: "Desenvolvimento na máquina", grupo: "Ombros", tipo: "composto", equipamento: "maquina",
    secundarios: ["Tríceps"],
    instrucoes: [
      "Ajuste o banco para as pegadas ficarem na altura dos ombros.",
      "Empurre sem travar o cotovelo e volte até pouco abaixo da linha do ombro.",
    ],
  },
  {
    nome: "Desenvolvimento no Smith", grupo: "Ombros", tipo: "composto", equipamento: "maquina",
    secundarios: ["Tríceps"],
    instrucoes: [
      "Banco posicionado para a barra descer na linha do queixo.",
      "A guia tira o trabalho de estabilizar — use para carga, não para relaxar o tronco.",
    ],
  },
  {
    nome: "Remada alta com barra", grupo: "Ombros", tipo: "composto", equipamento: "barra",
    secundarios: ["Trapézio", "Bíceps"],
    aliases: ["remada alta", "upright row"],
    instrucoes: [
      "Pegada na largura dos ombros — mais fechada que isso aperta o ombro.",
      "Puxe a barra rente ao corpo até a altura do peito, cotovelos acima das mãos.",
      "Pare se sentir pinçada no ombro: reduza a altura antes de reduzir o peso.",
    ],
  },
  {
    nome: "Elevação lateral com halteres", grupo: "Ombros", tipo: "isolado", equipamento: "halter",
    secundarios: ["Trapézio"],
    aliases: ["lateral", "elevação lateral", "lateral raise"],
    instrucoes: [
      "Cotovelos levemente flexionados, tronco firme e parado.",
      "Suba até a linha dos ombros liderando com o cotovelo, não com a mão.",
      "Desça em três tempos — a descida rápida é metade do exercício jogada fora.",
    ],
  },
  {
    nome: "Elevação lateral na polia", grupo: "Ombros", tipo: "isolado", equipamento: "polia",
    secundarios: ["Trapézio"],
    aliases: ["lateral polia"],
    instrucoes: [
      "Polia baixa atrás do corpo, cabo passando à frente das pernas.",
      "Suba até a linha do ombro; a tensão continua no ponto de baixo, ao contrário do halter.",
    ],
  },
  {
    nome: "Elevação lateral na máquina", grupo: "Ombros", tipo: "isolado", equipamento: "maquina",
    secundarios: ["Trapézio"],
    instrucoes: [
      "Ajuste o assento para o eixo da máquina ficar na altura do ombro.",
      "Empurre com o braço todo, sem apertar a mão na pegada.",
    ],
  },
  {
    nome: "Elevação frontal com halteres", grupo: "Ombros", tipo: "isolado", equipamento: "halter",
    secundarios: ["Peito"],
    aliases: ["elevação frontal", "front raise"],
    instrucoes: [
      "Halteres à frente das coxas, cotovelos quase estendidos.",
      "Suba até a linha dos olhos sem balançar o tronco, e desça controlando.",
    ],
  },
  {
    nome: "Elevação frontal com barra", grupo: "Ombros", tipo: "isolado", equipamento: "barra",
    secundarios: ["Peito"],
    instrucoes: [
      "Pegada pronada na largura dos ombros, barra encostada nas coxas.",
      "Suba até a altura dos olhos mantendo o abdômen firme.",
    ],
  },
  {
    nome: "Crucifixo inverso com halteres", grupo: "Ombros", tipo: "isolado", equipamento: "halter",
    secundarios: ["Trapézio", "Costas"],
    aliases: ["inverso", "crucifixo inverso", "reverse fly", "voador inverso"],
    instrucoes: [
      "Tronco inclinado à frente, quase paralelo ao chão, halteres pendurados.",
      "Abra pelos cotovelos até a linha dos ombros, apertando as escápulas.",
      "Se o trapézio dominar, baixe o peso: aqui a carga certa é sempre menor do que parece.",
    ],
  },
  {
    nome: "Crucifixo inverso na máquina", grupo: "Ombros", tipo: "isolado", equipamento: "maquina",
    secundarios: ["Trapézio", "Costas"],
    aliases: ["peck deck inverso"],
    instrucoes: [
      "Peito apoiado, pegadas na altura dos ombros.",
      "Abra até a linha do tronco e volte devagar, sem deixar o peso bater.",
    ],
  },
  {
    nome: "Face pull na polia", grupo: "Ombros", tipo: "isolado", equipamento: "polia",
    secundarios: ["Trapézio", "Costas"],
    aliases: ["face pull", "puxada para o rosto"],
    instrucoes: [
      "Corda na polia na altura do rosto, um pé à frente.",
      "Puxe a corda à altura da testa abrindo as mãos e girando os ombros para fora.",
      "É o contrapeso de quem faz muito supino — vá leve e sinta na parte de trás do ombro.",
    ],
  },

  // ══ Trapézio ════════════════════════════════════════════════════════════
  {
    nome: "Encolhimento com barra", grupo: "Trapézio", tipo: "isolado", equipamento: "barra",
    secundarios: ["Antebraço"],
    aliases: ["encolhimento", "shrug", "trapézio barra"],
    instrucoes: [
      "Barra à frente das coxas, braços estendidos e relaxados.",
      "Suba os ombros na direção das orelhas, em linha reta — sem rodar.",
      "Segure no topo e desça devagar; girar o ombro aqui não acrescenta nada e desgasta a articulação.",
    ],
  },
  {
    nome: "Encolhimento com halteres", grupo: "Trapézio", tipo: "isolado", equipamento: "halter",
    secundarios: ["Antebraço"],
    aliases: ["encolhimento halteres"],
    instrucoes: [
      "Halteres ao lado do corpo, o que deixa o ombro numa linha mais confortável que a barra.",
      "Suba reto, segure, desça controlando.",
    ],
  },
  {
    nome: "Encolhimento na máquina", grupo: "Trapézio", tipo: "isolado", equipamento: "maquina",
    secundarios: ["Antebraço"],
    instrucoes: [
      "Pegadas ao lado do corpo, braços estendidos.",
      "Suba os ombros sem ajudar com o bíceps — o cotovelo fica travado.",
    ],
  },
  {
    nome: "Encolhimento no Smith", grupo: "Trapézio", tipo: "isolado", equipamento: "maquina",
    secundarios: ["Antebraço"],
    instrucoes: [
      "Barra à frente ou atrás das coxas, na guia.",
      "A trave mantém a linha reta, que é exatamente o que o encolhimento pede.",
    ],
  },
  {
    nome: "Remada alta com halteres", grupo: "Trapézio", tipo: "composto", equipamento: "halter",
    secundarios: ["Ombros", "Bíceps"],
    instrucoes: [
      "Halteres à frente das coxas, quase encostados.",
      "Puxe rente ao corpo até a altura do peito, cotovelos liderando.",
    ],
  },

  // ══ Bíceps ══════════════════════════════════════════════════════════════
  {
    nome: "Rosca direta com barra", grupo: "Bíceps", tipo: "isolado", equipamento: "barra",
    secundarios: ["Antebraço"],
    aliases: ["rosca", "rosca direta", "curl", "biceps barra"],
    instrucoes: [
      "Cotovelos colados ao tronco e parados: eles são a dobradiça, não parte do movimento.",
      "Suba até o antebraço passar a vertical e aperte no topo.",
      "Desça até estender por completo — a parte de baixo é onde o bíceps mais cresce.",
    ],
  },
  {
    nome: "Rosca direta com barra W", grupo: "Bíceps", tipo: "isolado", equipamento: "barra",
    secundarios: ["Antebraço"],
    aliases: ["barra w", "ez", "rosca w"],
    instrucoes: [
      "A barra W gira levemente o punho, o que alivia quem sente o punho na barra reta.",
      "Mesma regra do cotovelo travado ao tronco.",
    ],
  },
  {
    nome: "Rosca alternada com halteres", grupo: "Bíceps", tipo: "isolado", equipamento: "halter",
    secundarios: ["Antebraço"],
    aliases: ["rosca alternada", "alternada"],
    instrucoes: [
      "Comece com as palmas voltadas para as coxas.",
      "Suba um braço girando a palma para cima na metade do caminho, e desça antes de subir o outro.",
    ],
  },
  {
    nome: "Rosca simultânea com halteres", grupo: "Bíceps", tipo: "isolado", equipamento: "halter",
    secundarios: ["Antebraço"],
    instrucoes: [
      "Os dois braços ao mesmo tempo, palmas para cima o movimento todo.",
      "Tronco parado — se ele balança para ajudar, o peso está alto.",
    ],
  },
  {
    nome: "Rosca martelo", grupo: "Bíceps", tipo: "isolado", equipamento: "halter",
    secundarios: ["Antebraço"],
    aliases: ["martelo", "hammer", "hammer curl"],
    instrucoes: [
      "Palmas voltadas uma para a outra o tempo todo, como quem segura um martelo.",
      "Suba sem girar o punho; pega o braquial e o antebraço mais que a rosca comum.",
    ],
  },
  {
    nome: "Rosca concentrada", grupo: "Bíceps", tipo: "isolado", equipamento: "halter",
    aliases: ["concentrada"],
    instrucoes: [
      "Sentado, cotovelo apoiado na face interna da coxa.",
      "Suba até o topo e aperte; o apoio impede qualquer ajuda do ombro.",
    ],
  },
  {
    nome: "Rosca inclinada com halteres", grupo: "Bíceps", tipo: "isolado", equipamento: "halter",
    secundarios: ["Antebraço"],
    aliases: ["rosca inclinada"],
    instrucoes: [
      "Banco a 45°, braços pendurados atrás da linha do tronco.",
      "Essa posição alonga a cabeça longa do bíceps — vá mais leve do que na rosca em pé.",
    ],
  },
  {
    nome: "Rosca scott", grupo: "Bíceps", tipo: "isolado", equipamento: "barra",
    secundarios: ["Antebraço"],
    aliases: ["scott", "banco scott", "preacher curl"],
    instrucoes: [
      "Axila apoiada no topo do banco, braço inteiro em contato com a almofada.",
      "Desça até quase estender e suba sem tirar o braço do apoio.",
      "Não solte o peso lá embaixo: é onde o cotovelo fica mais exposto.",
    ],
  },
  {
    nome: "Rosca na polia", grupo: "Bíceps", tipo: "isolado", equipamento: "polia",
    secundarios: ["Antebraço"],
    aliases: ["rosca polia"],
    instrucoes: [
      "Polia baixa, barra ou corda, cotovelos colados ao tronco.",
      "A tensão do cabo não some no topo — segure o aperto por um segundo.",
    ],
  },
  {
    nome: "Rosca martelo na polia com corda", grupo: "Bíceps", tipo: "isolado", equipamento: "polia",
    secundarios: ["Antebraço"],
    instrucoes: [
      "Corda na polia baixa, palmas voltadas uma para a outra.",
      "Suba sem girar o punho e abra levemente a corda no topo.",
    ],
  },
  {
    nome: "Rosca 21", grupo: "Bíceps", tipo: "isolado", equipamento: "barra",
    secundarios: ["Antebraço"],
    aliases: ["21", "vinte e um"],
    instrucoes: [
      "Sete repetições da base até a metade, sete da metade ao topo, sete completas.",
      "É uma técnica de intensidade: use peso bem menor que na rosca comum.",
    ],
  },

  // ══ Tríceps ═════════════════════════════════════════════════════════════
  {
    nome: "Supino fechado", grupo: "Tríceps", tipo: "composto", equipamento: "barra",
    secundarios: ["Peito", "Ombros"],
    aliases: ["supino fechado", "close grip", "pegada fechada"],
    instrucoes: [
      "Pegada na largura dos ombros — mais fechada que isso castiga o punho, não o tríceps.",
      "Desça a barra à parte baixa do peito com os cotovelos rentes ao tronco.",
      "Empurre até estender; o cotovelo é quem manda no movimento.",
    ],
  },
  {
    nome: "Mergulho no banco", grupo: "Tríceps", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.55, met: 5.5,
    secundarios: ["Peito", "Ombros"],
    aliases: ["banco", "mergulho banco", "bench dip"],
    instrucoes: [
      "Mãos no banco atrás do corpo, quadril rente à borda.",
      "Desça até o cotovelo formar 90°, sem afastar o quadril do banco.",
      "Se o ombro reclamar, troque pelas paralelas ou pela polia — este é o mais duro para a articulação.",
    ],
  },
  {
    nome: "Paralelas para tríceps", grupo: "Tríceps", tipo: "composto", equipamento: "peso_corporal",
    fracao: 1.0, met: 8,
    secundarios: ["Peito", "Ombros"],
    aliases: ["dips triceps", "mergulho paralelas"],
    instrucoes: [
      "Tronco na vertical, ao contrário das paralelas para peito.",
      "Cotovelos rentes ao corpo, descendo até 90° e subindo até estender.",
    ],
  },
  {
    nome: "Tríceps testa com barra W", grupo: "Tríceps", tipo: "isolado", equipamento: "barra",
    aliases: ["testa", "skull crusher", "triceps testa"],
    instrucoes: [
      "Deitado, braços na vertical, barra W acima da testa.",
      "Dobre só o cotovelo, levando a barra até a testa ou pouco atrás dela.",
      "O braço não se mexe — se o cotovelo abre para os lados, baixe o peso.",
    ],
  },
  {
    nome: "Tríceps testa com halteres", grupo: "Tríceps", tipo: "isolado", equipamento: "halter",
    instrucoes: [
      "Um halter em cada mão, palmas voltadas uma para a outra.",
      "Desça ao lado da cabeça; a pegada neutra costuma incomodar menos o cotovelo.",
    ],
  },
  {
    nome: "Tríceps na polia com barra", grupo: "Tríceps", tipo: "isolado", equipamento: "polia",
    aliases: ["triceps pulley", "triceps barra polia"],
    instrucoes: [
      "Polia alta, cotovelos colados ao tronco e parados.",
      "Empurre até estender e volte só até o cotovelo formar 90°.",
    ],
  },
  {
    nome: "Tríceps na polia com corda", grupo: "Tríceps", tipo: "isolado", equipamento: "polia",
    aliases: ["corda", "triceps corda"],
    instrucoes: [
      "Mesma posição da barra, mas abra a corda no fim do movimento.",
      "A abertura no final é o que a corda tem a mais — sem ela, use a barra e vá mais pesado.",
    ],
  },
  {
    nome: "Tríceps unilateral na polia", grupo: "Tríceps", tipo: "isolado", equipamento: "polia",
    instrucoes: [
      "Uma mão só, pegada supinada ou neutra, cotovelo travado ao lado do tronco.",
      "Serve para igualar lados quando um braço puxa o outro.",
    ],
  },
  {
    nome: "Tríceps francês com halter", grupo: "Tríceps", tipo: "isolado", equipamento: "halter",
    aliases: ["francês", "triceps frances", "overhead extension"],
    instrucoes: [
      "Halter acima da cabeça segurado com as duas mãos, cotovelos apontando para cima.",
      "Desça atrás da nuca e suba estendendo, sem abrir os cotovelos.",
      "A posição alonga a cabeça longa do tríceps — é a que mais pede aquecimento.",
    ],
  },
  {
    nome: "Tríceps coice", grupo: "Tríceps", tipo: "isolado", equipamento: "halter",
    aliases: ["coice de tríceps", "kickback"],
    instrucoes: [
      "Tronco inclinado, braço colado ao corpo com o cotovelo a 90°.",
      "Estenda o cotovelo para trás e segure no topo — aqui o topo é a parte que conta.",
    ],
  },
  {
    nome: "Tríceps na máquina", grupo: "Tríceps", tipo: "isolado", equipamento: "maquina",
    instrucoes: [
      "Ajuste o assento para o eixo ficar na altura do cotovelo.",
      "Estenda sem travar e volte controlando.",
    ],
  },

  // ══ Antebraço ═══════════════════════════════════════════════════════════
  {
    nome: "Rosca de punho com barra", grupo: "Antebraço", tipo: "isolado", equipamento: "barra",
    aliases: ["punho", "rosca punho", "wrist curl"],
    instrucoes: [
      "Antebraços apoiados nas coxas ou num banco, palmas para cima, punhos livres da borda.",
      "Deixe a barra rolar até a ponta dos dedos e enrole de volta.",
    ],
  },
  {
    nome: "Rosca de punho inversa com barra", grupo: "Antebraço", tipo: "isolado", equipamento: "barra",
    instrucoes: [
      "Mesma posição, palmas para baixo.",
      "Sobe muito menos peso que na versão normal — é esperado.",
    ],
  },
  {
    nome: "Rosca inversa com barra", grupo: "Antebraço", tipo: "isolado", equipamento: "barra",
    secundarios: ["Bíceps"],
    aliases: ["rosca inversa", "reverse curl"],
    instrucoes: [
      "Pegada pronada na largura dos ombros, cotovelos colados ao tronco.",
      "Suba como numa rosca comum; pega o braquiorradial, que é o que engrossa o antebraço.",
    ],
  },
  {
    nome: "Passeio do fazendeiro", grupo: "Antebraço", tipo: "composto", equipamento: "halter",
    secundarios: ["Trapézio", "Core"],
    aliases: ["farmer walk", "fazendeiro", "caminhada do fazendeiro"],
    instrucoes: [
      "Um peso pesado em cada mão, ombros para trás e tronco ereto.",
      "Ande em linha reta por tempo ou distância, sem deixar os ombros caírem à frente.",
    ],
  },

  // ══ Quadríceps ══════════════════════════════════════════════════════════
  {
    nome: "Agachamento livre", grupo: "Quadríceps", tipo: "composto", equipamento: "barra",
    secundarios: ["Glúteos", "Posterior", "Core"],
    aliases: ["agachamento", "squat", "agacho"],
    instrucoes: [
      "Barra apoiada no trapézio, pés na largura dos ombros e pontas levemente para fora.",
      "Desça empurrando o quadril para trás e os joelhos para fora, até a coxa passar da paralela.",
      "Suba empurrando o chão; o joelho acompanha a linha do pé, e a lombar não arredonda no fundo.",
    ],
  },
  {
    nome: "Agachamento frontal", grupo: "Quadríceps", tipo: "composto", equipamento: "barra",
    secundarios: ["Glúteos", "Core"],
    aliases: ["front squat", "agachamento frontal"],
    instrucoes: [
      "Barra apoiada nos deltoides à frente, cotovelos bem altos.",
      "Desça com o tronco o mais vertical possível — se o cotovelo cai, a barra vai junto.",
      "Pega mais quadríceps que o agachamento livre, e sobe menos peso.",
    ],
  },
  {
    nome: "Agachamento no Smith", grupo: "Quadríceps", tipo: "composto", equipamento: "maquina",
    secundarios: ["Glúteos"],
    instrucoes: [
      "Pés um pouco à frente da linha da barra, já que a guia impede a inclinação natural.",
      "Desça até a coxa passar da paralela e suba sem travar o joelho.",
    ],
  },
  {
    nome: "Agachamento hack", grupo: "Quadríceps", tipo: "composto", equipamento: "maquina",
    secundarios: ["Glúteos"],
    aliases: ["hack", "hack squat"],
    instrucoes: [
      "Costas inteiras no apoio, pés no meio da plataforma.",
      "Desça até 90° ou mais e suba sem tirar a lombar do encosto.",
    ],
  },
  {
    nome: "Agachamento búlgaro com halteres", grupo: "Quadríceps", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos", "Core"],
    aliases: ["búlgaro", "bulgaro", "bulgarian split squat", "afundo búlgaro"],
    instrucoes: [
      "Pé de trás no banco, pé da frente longe o bastante para o joelho não passar muito da ponta.",
      "Desça na vertical até o joelho de trás quase tocar o chão.",
      "Quanto mais à frente o pé da frente, mais glúteo; mais perto, mais quadríceps.",
    ],
  },
  {
    nome: "Agachamento goblet", grupo: "Quadríceps", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos", "Core"],
    aliases: ["goblet", "goblet squat"],
    instrucoes: [
      "Um halter segurado na vertical junto ao peito, cotovelos por dentro dos joelhos.",
      "Desça fundo mantendo o tronco ereto — o peso à frente serve de contrapeso.",
    ],
  },
  {
    nome: "Agachamento sumô", grupo: "Quadríceps", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos", "Posterior"],
    aliases: ["sumô", "sumo"],
    instrucoes: [
      "Pés bem mais largos que os ombros, pontas abertas a uns 45°.",
      "Desça entre os calcanhares empurrando os joelhos para fora.",
    ],
  },
  {
    nome: "Agachamento livre com halteres", grupo: "Quadríceps", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos", "Core"],
    instrucoes: [
      "Um halter em cada mão ao lado do corpo.",
      "Mesma descida do agachamento com barra; o limite costuma ser a pegada, não a perna.",
    ],
  },
  {
    nome: "Leg press 45°", grupo: "Quadríceps", tipo: "composto", equipamento: "maquina",
    secundarios: ["Glúteos", "Posterior"],
    aliases: ["leg press", "leg", "leg 45"],
    instrucoes: [
      "Pés no meio da plataforma na largura dos ombros; lombar colada no encosto.",
      "Desça até 90° ou até a lombar começar a sair — o que vier primeiro.",
      "Suba sem travar o joelho no topo.",
    ],
  },
  {
    nome: "Leg press horizontal", grupo: "Quadríceps", tipo: "composto", equipamento: "maquina",
    secundarios: ["Glúteos"],
    instrucoes: [
      "Ajuste o assento para o joelho chegar a 90° no fim da descida.",
      "Empurre com o pé inteiro, sem tirar o calcanhar da plataforma.",
    ],
  },
  {
    nome: "Afundo com halteres", grupo: "Quadríceps", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos", "Core"],
    aliases: ["afundo", "lunge", "avanço"],
    instrucoes: [
      "Dê um passo à frente e desça na vertical até o joelho de trás quase tocar o chão.",
      "Volte empurrando com o calcanhar da perna da frente.",
    ],
  },
  {
    nome: "Passada com halteres", grupo: "Quadríceps", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos", "Core"],
    aliases: ["passada", "walking lunge", "afundo caminhando"],
    instrucoes: [
      "Como o afundo, mas andando: cada repetição avança um passo.",
      "Tronco ereto e passo largo o bastante para o joelho da frente não passar muito da ponta do pé.",
    ],
  },
  {
    nome: "Subida no banco", grupo: "Quadríceps", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos"],
    aliases: ["step up", "subida no step"],
    instrucoes: [
      "Banco na altura do joelho, pé inteiro apoiado em cima.",
      "Suba empurrando com a perna de cima, sem impulso da perna de baixo.",
    ],
  },
  {
    nome: "Cadeira extensora", grupo: "Quadríceps", tipo: "isolado", equipamento: "maquina",
    aliases: ["extensora", "cadeira extensora"],
    instrucoes: [
      "Encoste o joelho no eixo da máquina e ajuste o rolo pouco acima do tornozelo.",
      "Estenda até quase travar, segure no topo e desça devagar.",
    ],
  },

  // ══ Posterior ═══════════════════════════════════════════════════════════
  // Terra convencional fica em Posterior, não em Costas: eretores, glúteo e
  // posterior fazem o trabalho; os lats só estabilizam. Em Costas ele contaria
  // zero série efetiva pra Posterior na análise. Decisão do usuário, 2026-07-16.
  {
    nome: "Levantamento terra", grupo: "Posterior", tipo: "composto", equipamento: "barra",
    secundarios: ["Glúteos", "Costas", "Trapézio", "Antebraço"],
    aliases: ["terra", "deadlift", "levantamento terra"],
    instrucoes: [
      "Barra sobre o meio do pé, canela quase encostando, pegada por fora dos joelhos.",
      "Peito alto e lombar neutra; empurre o chão com as pernas e a barra sobe rente à perna.",
      "Estenda quadril e joelho ao mesmo tempo; nada de puxar com a lombar arredondada.",
    ],
  },
  {
    nome: "Levantamento terra romeno", grupo: "Posterior", tipo: "composto", equipamento: "barra",
    secundarios: ["Glúteos", "Costas"],
    aliases: ["romeno", "rdl", "terra romeno"],
    instrucoes: [
      "Comece em pé com a barra nas coxas, joelhos levemente flexionados e fixos.",
      "Empurre o quadril para trás deixando a barra descer rente à perna até sentir o posterior alongar.",
      "Suba estendendo o quadril; a amplitude é do posterior, não do chão.",
    ],
  },
  {
    nome: "Levantamento terra sumô", grupo: "Posterior", tipo: "composto", equipamento: "barra",
    secundarios: ["Glúteos", "Quadríceps"],
    aliases: ["terra sumo", "sumo deadlift"],
    instrucoes: [
      "Pés bem largos, pontas abertas, mãos por dentro dos joelhos.",
      "Tronco fica mais vertical que no convencional, e a perna faz mais trabalho.",
    ],
  },
  {
    nome: "Stiff com barra", grupo: "Posterior", tipo: "composto", equipamento: "barra",
    secundarios: ["Glúteos"],
    aliases: ["stiff", "stiff leg deadlift"],
    instrucoes: [
      "Joelhos quase estendidos, barra rente às pernas.",
      "Desça pelo quadril até sentir o posterior; a lombar não arredonda em momento nenhum.",
    ],
  },
  {
    nome: "Stiff com halteres", grupo: "Posterior", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos"],
    instrucoes: [
      "Halteres à frente das coxas, mesma mecânica de quadril do stiff com barra.",
      "Os halteres permitem descer um pouco mais que a barra.",
    ],
  },
  {
    nome: "Bom dia com barra", grupo: "Posterior", tipo: "composto", equipamento: "barra",
    secundarios: ["Glúteos", "Costas"],
    aliases: ["bom dia", "good morning"],
    instrucoes: [
      "Barra no trapézio como no agachamento, joelhos levemente flexionados.",
      "Incline o tronco à frente pelo quadril até quase a paralela, e volte.",
      "Vá bem leve: é o exercício onde a técnica quebra mais rápido com peso a mais.",
    ],
  },
  {
    nome: "Mesa flexora", grupo: "Posterior", tipo: "isolado", equipamento: "maquina",
    aliases: ["mesa", "mesa flexora", "leg curl"],
    instrucoes: [
      "Deitado de bruços, o rolo logo acima do calcanhar e o joelho fora da borda.",
      "Flexione até o máximo e desça devagar sem tirar o quadril da mesa.",
    ],
  },
  {
    nome: "Cadeira flexora", grupo: "Posterior", tipo: "isolado", equipamento: "maquina",
    aliases: ["flexora sentada", "cadeira flexora"],
    instrucoes: [
      "Sentado, joelho alinhado ao eixo e o rolo acima do calcanhar.",
      "Puxe para baixo e para trás, segurando um instante no fim.",
    ],
  },
  {
    nome: "Flexora em pé na polia", grupo: "Posterior", tipo: "isolado", equipamento: "polia",
    instrucoes: [
      "Tornozeleira na polia baixa, uma perna de cada vez.",
      "Flexione o joelho sem deixar o quadril ir à frente.",
    ],
  },
  {
    nome: "Hiperextensão lombar", grupo: "Posterior", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.45, met: 3.8,
    secundarios: ["Glúteos", "Core"],
    aliases: ["hiperextensão", "banco romano", "extensão lombar"],
    instrucoes: [
      "Apoio na altura do quadril, não da coxa, para o quadril poder dobrar.",
      "Desça pelo quadril e suba até o tronco alinhar com as pernas — sem passar disso.",
    ],
  },

  // ══ Glúteos ═════════════════════════════════════════════════════════════
  {
    nome: "Elevação pélvica com barra", grupo: "Glúteos", tipo: "composto", equipamento: "barra",
    secundarios: ["Posterior", "Core"],
    aliases: ["elevação pélvica", "hip thrust", "pélvica"],
    instrucoes: [
      "Costas apoiadas num banco na linha das escápulas, barra sobre o quadril com proteção.",
      "Suba até tronco e coxa formarem uma linha reta, apertando o glúteo no topo.",
      "Queixo para o peito e costela para baixo — quem sobe com a lombar sente na lombar.",
    ],
  },
  {
    nome: "Elevação pélvica unilateral", grupo: "Glúteos", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.4, met: 3.8,
    secundarios: ["Posterior"],
    instrucoes: [
      "Mesma posição, uma perna só, a outra suspensa com o joelho dobrado.",
      "Suba mantendo o quadril nivelado — sem deixar um lado cair.",
    ],
  },
  {
    nome: "Ponte de glúteo", grupo: "Glúteos", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.35, met: 3.8,
    secundarios: ["Posterior"],
    aliases: ["ponte", "glute bridge"],
    instrucoes: [
      "Deitado no chão, pés apoiados perto do quadril.",
      "Empurre o chão com os calcanhares e suba o quadril, apertando o glúteo no topo.",
    ],
  },
  {
    nome: "Coice na polia", grupo: "Glúteos", tipo: "isolado", equipamento: "polia",
    secundarios: ["Posterior"],
    aliases: ["coice", "glute kickback"],
    instrucoes: [
      "Tornozeleira na polia baixa, tronco levemente inclinado à frente.",
      "Estenda o quadril para trás sem arquear a lombar — o movimento é do quadril, não da coluna.",
    ],
  },
  {
    nome: "Coice na máquina", grupo: "Glúteos", tipo: "isolado", equipamento: "maquina",
    secundarios: ["Posterior"],
    instrucoes: [
      "Apoie o tronco e empurre a plataforma com o pé inteiro.",
      "Estenda até a linha do tronco e volte controlando.",
    ],
  },
  {
    nome: "Abdução na máquina", grupo: "Glúteos", tipo: "isolado", equipamento: "maquina",
    aliases: ["abdutora", "cadeira abdutora"],
    instrucoes: [
      "Sentado, abra as pernas contra o apoio até o fim da amplitude.",
      "Incline o tronco à frente para pegar mais o glúteo médio.",
    ],
  },
  {
    nome: "Abdução na polia", grupo: "Glúteos", tipo: "isolado", equipamento: "polia",
    instrucoes: [
      "Tornozeleira na polia baixa, apoiando-se com a mão livre.",
      "Abra a perna para o lado sem inclinar o tronco para o outro lado.",
    ],
  },

  // ══ Panturrilha ═════════════════════════════════════════════════════════
  {
    nome: "Panturrilha em pé na máquina", grupo: "Panturrilha", tipo: "isolado", equipamento: "maquina",
    aliases: ["panturrilha", "gêmeos", "gemeos", "calf raise"],
    instrucoes: [
      "Ponta do pé na plataforma, calcanhar livre para descer abaixo dela.",
      "Suba o mais alto que der e segure um instante; desça até alongar por completo.",
    ],
  },
  {
    nome: "Panturrilha sentado na máquina", grupo: "Panturrilha", tipo: "isolado", equipamento: "maquina",
    aliases: ["sóleo", "soleo", "panturrilha sentado"],
    instrucoes: [
      "Joelho dobrado a 90°, que é o que tira o gastrocnêmio e põe o sóleo no trabalho.",
      "Amplitude completa, subindo alto e descendo até o fim.",
    ],
  },
  {
    nome: "Panturrilha no leg press", grupo: "Panturrilha", tipo: "isolado", equipamento: "maquina",
    instrucoes: [
      "Pontas dos pés na borda de baixo da plataforma, joelhos quase estendidos.",
      "Empurre com o pé e volte deixando o tornozelo flexionar por completo.",
    ],
  },
  {
    nome: "Panturrilha em pé com halteres", grupo: "Panturrilha", tipo: "isolado", equipamento: "halter",
    instrucoes: [
      "Ponta dos pés num degrau ou anilha, halteres ao lado do corpo.",
      "Suba e desça devagar; o desafio costuma ser o equilíbrio, não a carga.",
    ],
  },
  {
    nome: "Panturrilha no Smith", grupo: "Panturrilha", tipo: "isolado", equipamento: "maquina",
    instrucoes: [
      "Barra no trapézio, pontas dos pés numa plataforma baixa.",
      "A guia libera o equilíbrio e deixa ir mais pesado.",
    ],
  },

  // ══ Core ════════════════════════════════════════════════════════════════
  {
    nome: "Abdominal supra no solo", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.35, met: 3.8,
    aliases: ["abdominal", "crunch", "supra"],
    instrucoes: [
      "Deitado, joelhos dobrados, mãos ao lado da cabeça sem puxar o pescoço.",
      "Enrole a coluna tirando as escápulas do chão, e desça devagar.",
    ],
  },
  {
    nome: "Abdominal infra no banco", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.4, met: 3.8,
    aliases: ["infra", "abdominal infra"],
    instrucoes: [
      "Deitado no banco segurando a borda atrás da cabeça.",
      "Traga os joelhos ao peito enrolando o quadril — não é só levantar a perna.",
    ],
  },
  {
    nome: "Abdominal na polia", grupo: "Core", tipo: "isolado", equipamento: "polia",
    secundarios: ["Ombros"],
    aliases: ["abdominal ajoelhado", "cable crunch"],
    instrucoes: [
      "Ajoelhado de costas para a polia alta, corda ao lado da cabeça.",
      "Enrole o tronco levando o cotovelo ao joelho; o quadril fica parado.",
    ],
  },
  {
    nome: "Abdominal na máquina", grupo: "Core", tipo: "isolado", equipamento: "maquina",
    instrucoes: [
      "Ajuste o assento para o eixo ficar na altura do umbigo.",
      "Enrole o tronco contra a resistência e volte controlando.",
    ],
  },
  {
    nome: "Elevação de pernas suspenso", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.45, met: 5.5,
    secundarios: ["Antebraço"],
    aliases: ["elevação de pernas", "hanging leg raise", "pernas na barra"],
    instrucoes: [
      "Pendurado na barra, ombros ativos e corpo sem balançar.",
      "Suba as pernas enrolando o quadril; parar em 90° é elevação de quadril, não de perna.",
    ],
  },
  {
    nome: "Elevação de pernas no solo", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.4, met: 3.8,
    instrucoes: [
      "Deitado, mãos sob o quadril para proteger a lombar.",
      "Desça as pernas só até onde a lombar continuar colada no chão.",
    ],
  },
  {
    nome: "Prancha", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.6, met: 3.8, medida: "segundos",
    secundarios: ["Ombros"],
    aliases: ["prancha", "plank"],
    instrucoes: [
      "Cotovelos sob os ombros, corpo em linha do calcanhar à cabeça.",
      "Aperte glúteo e abdômen; o quadril não sobe nem afunda.",
      "Conte o tempo pela linha, não pelo relógio: quando o quadril cai, a série acabou.",
    ],
  },
  {
    nome: "Prancha lateral", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.55, met: 3.8, medida: "segundos",
    secundarios: ["Ombros"],
    aliases: ["prancha lateral", "side plank"],
    instrucoes: [
      "Cotovelo sob o ombro, corpo alinhado, quadril alto.",
      "Segure sem deixar o quadril cair, e troque de lado.",
    ],
  },
  {
    nome: "Rotação russa", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.3, met: 3.8,
    aliases: ["russian twist", "rotação russa", "abdominal russo"],
    instrucoes: [
      "Sentado com o tronco inclinado para trás e os pés no chão ou suspensos.",
      "Gire o tronco de um lado ao outro levando o peso junto — o giro é do tronco, não dos braços.",
    ],
  },
  {
    nome: "Roda abdominal", grupo: "Core", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.55, met: 5.5,
    secundarios: ["Ombros", "Costas"],
    aliases: ["ab wheel", "roda", "rodinha"],
    instrucoes: [
      "Ajoelhado, role à frente mantendo a lombar neutra e o glúteo apertado.",
      "Vá só até onde conseguir voltar sem arquear — a distância aumenta com o tempo.",
    ],
  },
  {
    nome: "Escalador", grupo: "Core", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.6, met: 8,
    secundarios: ["Ombros", "Quadríceps"],
    aliases: ["mountain climber", "escalador"],
    instrucoes: [
      "Posição de prancha alta, mãos sob os ombros.",
      "Traga um joelho ao peito de cada vez, rápido, sem o quadril subir.",
    ],
  },

  // ══ Variações que a academia tem e o catálogo não tinha ═════════════════
  {
    nome: "Crucifixo na polia baixa", grupo: "Peito", tipo: "isolado", equipamento: "polia",
    secundarios: ["Ombros"],
    instrucoes: [
      "Polias baixas, um pé à frente, cotovelos travados em leve flexão.",
      "Suba as mãos em arco até a altura do peito, juntando à frente — pega mais a parte alta.",
    ],
  },
  {
    nome: "Supino na máquina convergente", grupo: "Peito", tipo: "composto", equipamento: "maquina",
    secundarios: ["Tríceps", "Ombros"],
    aliases: ["convergente"],
    instrucoes: [
      "As pegadas se aproximam na subida, imitando o arco dos halteres.",
      "Empurre até quase juntar as mãos e volte alongando.",
    ],
  },
  {
    nome: "Flexão com os pés elevados", grupo: "Peito", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.7, met: 8,
    secundarios: ["Ombros", "Tríceps", "Core"],
    aliases: ["flexão declinada"],
    instrucoes: [
      "Pés num banco, mãos no chão pouco mais largas que os ombros.",
      "Quanto mais alto o pé, mais o exercício sobe para a parte alta do peito e o ombro.",
    ],
  },
  {
    nome: "Puxada na máquina", grupo: "Costas", tipo: "composto", equipamento: "maquina",
    secundarios: ["Bíceps"],
    instrucoes: [
      "Peito no apoio quando houver; pegadas acima da cabeça.",
      "Puxe até a linha do queixo levando os cotovelos para baixo.",
    ],
  },
  {
    nome: "Remada unilateral na polia", grupo: "Costas", tipo: "composto", equipamento: "polia",
    secundarios: ["Bíceps"],
    instrucoes: [
      "Sentado ou em pé, uma mão só na polia baixa.",
      "Puxe ao quadril deixando o ombro ir à frente no alongamento — a rotação do tronco é permitida aqui.",
    ],
  },
  {
    nome: "Puxada unilateral na polia alta", grupo: "Costas", tipo: "composto", equipamento: "polia",
    secundarios: ["Bíceps"],
    instrucoes: [
      "Ajoelhado ou sentado, uma mão só, pegada neutra.",
      "Serve para igualar lados quando um puxa mais que o outro.",
    ],
  },
  {
    nome: "Remada no Smith", grupo: "Costas", tipo: "composto", equipamento: "maquina",
    secundarios: ["Bíceps", "Trapézio"],
    instrucoes: [
      "Tronco a uns 45°, barra na guia.",
      "A trave segura a linha da barra e deixa focar na puxada.",
    ],
  },
  {
    nome: "Elevação lateral unilateral na polia", grupo: "Ombros", tipo: "isolado", equipamento: "polia",
    secundarios: ["Trapézio"],
    instrucoes: [
      "De lado para a polia baixa, cabo cruzando à frente do corpo.",
      "Suba até a linha do ombro segurando-se com a mão livre, sem inclinar o tronco.",
    ],
  },
  {
    nome: "Elevação em Y na polia", grupo: "Ombros", tipo: "isolado", equipamento: "polia",
    secundarios: ["Trapézio", "Costas"],
    aliases: ["y raise"],
    instrucoes: [
      "Polias baixas cruzadas, subindo as mãos em diagonal até formar um Y acima da cabeça.",
      "É trabalho de trapézio inferior e ombro — vá leve.",
    ],
  },
  {
    nome: "Rotação externa na polia", grupo: "Ombros", tipo: "isolado", equipamento: "polia",
    aliases: ["rotador", "manguito"],
    instrucoes: [
      "Cotovelo colado ao tronco a 90°, cabo na altura do cotovelo.",
      "Gire o antebraço para fora sem afastar o cotovelo do corpo.",
      "É prevenção, não hipertrofia: carga leve e movimento limpo.",
    ],
  },
  {
    nome: "Rosca scott com halteres", grupo: "Bíceps", tipo: "isolado", equipamento: "halter",
    secundarios: ["Antebraço"],
    instrucoes: [
      "Um braço de cada vez no banco scott, com halter.",
      "Desça até quase estender; a versão unilateral expõe diferença entre os lados.",
    ],
  },
  {
    nome: "Rosca cruzada", grupo: "Bíceps", tipo: "isolado", equipamento: "halter",
    secundarios: ["Antebraço"],
    aliases: ["cross body", "rosca cross"],
    instrucoes: [
      "Pegada de martelo, levando o halter em diagonal até o ombro oposto.",
      "Pega o braquial, que empurra o bíceps para cima quando cresce.",
    ],
  },
  {
    nome: "Tríceps testa na polia", grupo: "Tríceps", tipo: "isolado", equipamento: "polia",
    instrucoes: [
      "Deitado no banco à frente da polia baixa, barra ou corda acima da testa.",
      "A tensão do cabo não some no topo, ao contrário da barra.",
    ],
  },
  {
    nome: "Tríceps invertido na polia", grupo: "Tríceps", tipo: "isolado", equipamento: "polia",
    instrucoes: [
      "Pegada supinada na barra da polia alta, cotovelos colados.",
      "Estenda para baixo; pega mais a cabeça medial do tríceps.",
    ],
  },
  {
    nome: "Extensora unilateral", grupo: "Quadríceps", tipo: "isolado", equipamento: "maquina",
    instrucoes: [
      "Uma perna de cada vez na cadeira extensora.",
      "Serve para igualar lados e para sentir mais o pico da contração.",
    ],
  },
  {
    nome: "Leg press unilateral", grupo: "Quadríceps", tipo: "composto", equipamento: "maquina",
    secundarios: ["Glúteos"],
    instrucoes: [
      "Um pé no centro da plataforma, o outro apoiado fora.",
      "Desça até 90° mantendo a lombar colada; use bem menos que metade da carga bilateral.",
    ],
  },
  {
    nome: "Agachamento sissy", grupo: "Quadríceps", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.65, met: 5.5,
    secundarios: ["Core"],
    aliases: ["sissy squat"],
    instrucoes: [
      "Apoie-se em algo firme, suba nas pontas dos pés e leve o joelho à frente inclinando o tronco para trás.",
      "Tronco e coxa formam uma linha só; é quadríceps puro e pede joelho saudável.",
    ],
  },
  {
    nome: "Passada no Smith", grupo: "Quadríceps", tipo: "composto", equipamento: "maquina",
    secundarios: ["Glúteos"],
    instrucoes: [
      "Um pé à frente e outro atrás, barra no trapézio na guia.",
      "Desça na vertical até o joelho de trás quase tocar o chão.",
    ],
  },
  {
    nome: "Terra romeno unilateral", grupo: "Posterior", tipo: "composto", equipamento: "halter",
    secundarios: ["Glúteos", "Core"],
    instrucoes: [
      "Um halter na mão oposta à perna de apoio, joelho levemente flexionado.",
      "Desça pelo quadril deixando a perna livre subir atrás, formando uma linha reta com o tronco.",
    ],
  },
  {
    nome: "Flexora nórdica", grupo: "Posterior", tipo: "composto", equipamento: "peso_corporal",
    fracao: 0.75, met: 5.5,
    secundarios: ["Glúteos"],
    aliases: ["nórdico", "nordic curl"],
    instrucoes: [
      "Ajoelhado com os calcanhares presos, desça o tronco à frente o mais devagar possível.",
      "Use as mãos para amortecer no fim; é o exercício mais duro de posterior que existe.",
    ],
  },
  {
    nome: "Elevação pélvica na máquina", grupo: "Glúteos", tipo: "composto", equipamento: "maquina",
    secundarios: ["Posterior"],
    aliases: ["hip thrust máquina"],
    instrucoes: [
      "Costas no encosto, almofada sobre o quadril.",
      "Suba até a linha reta de tronco e coxa, apertando no topo.",
    ],
  },
  {
    nome: "Abdução deitado de lado", grupo: "Glúteos", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.2, met: 3.8,
    instrucoes: [
      "Deitado de lado, quadril empilhado e tronco sem rodar para trás.",
      "Suba a perna de cima até uns 45°, liderando com o calcanhar.",
    ],
  },
  {
    nome: "Panturrilha unilateral com halter", grupo: "Panturrilha", tipo: "isolado", equipamento: "halter",
    instrucoes: [
      "Uma perna num degrau, halter na mão do mesmo lado, apoiando-se com a outra.",
      "Amplitude completa: desce até alongar, sobe até o topo.",
    ],
  },
  {
    nome: "Abdominal bicicleta", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.35, met: 5.5,
    aliases: ["bicicleta"],
    instrucoes: [
      "Deitado, leve o cotovelo ao joelho oposto alternando os lados.",
      "O giro vem do tronco; a mão não puxa o pescoço.",
    ],
  },
  {
    nome: "Dead bug", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.25, met: 3.8,
    aliases: ["dead bug", "inseto morto"],
    instrucoes: [
      "Deitado, braços para cima e joelhos a 90°.",
      "Estenda braço e perna opostos sem deixar a lombar sair do chão, e volte.",
    ],
  },
  {
    nome: "Prancha alta", grupo: "Core", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.55, met: 3.8, medida: "segundos",
    secundarios: ["Ombros"],
    instrucoes: [
      "Como a prancha, mas com as mãos no chão sob os ombros.",
      "Mesma linha de corpo; o ombro trabalha mais que na versão de cotovelos.",
    ],
  },
  {
    nome: "Encolhimento na barra fixa", grupo: "Trapézio", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 1.0, met: 3.8,
    secundarios: ["Costas", "Antebraço"],
    instrucoes: [
      "Pendurado na barra com os braços estendidos.",
      "Puxe os ombros para baixo sem dobrar o cotovelo — ensina o encaixe da escápula da barra fixa.",
    ],
  },
  {
    nome: "Rolo de punho", grupo: "Antebraço", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 0.05, met: 3.8,
    aliases: ["wrist roller"],
    instrucoes: [
      "Braços estendidos à frente segurando o rolo, peso pendurado por uma corda.",
      "Enrole a corda girando só os punhos, e desenrole controlando.",
    ],
  },
  {
    nome: "Pegada isométrica na barra", grupo: "Antebraço", tipo: "isolado", equipamento: "peso_corporal",
    fracao: 1.0, met: 3.8, medida: "segundos",
    secundarios: ["Trapézio"],
    aliases: ["dead hang", "pendurado na barra"],
    instrucoes: [
      "Pendurado na barra, ombros ativos, o máximo de tempo que aguentar.",
      "Mede e treina a pegada, que costuma falhar antes das costas no terra e na barra.",
    ],
  },
  {
    nome: "Remada alta na polia", grupo: "Ombros", tipo: "composto", equipamento: "polia",
    secundarios: ["Trapézio", "Bíceps"],
    instrucoes: [
      "Barra na polia baixa, pegada na largura dos ombros.",
      "Puxe rente ao corpo até o peito, cotovelos acima das mãos.",
    ],
  },
  {
    nome: "Crucifixo inverso na polia", grupo: "Ombros", tipo: "isolado", equipamento: "polia",
    secundarios: ["Trapézio", "Costas"],
    instrucoes: [
      "Polias cruzadas na altura do ombro, uma em cada mão.",
      "Abra em arco até a linha do tronco, apertando a parte de trás do ombro.",
    ],
  },
  {
    nome: "Rosca direta na polia com barra reta", grupo: "Bíceps", tipo: "isolado", equipamento: "polia",
    secundarios: ["Antebraço"],
    instrucoes: [
      "Polia baixa com barra reta, cotovelos colados ao tronco.",
      "Suba até o antebraço passar a vertical e desça até estender.",
    ],
  },
  {
    nome: "Agachamento livre sem peso", grupo: "Quadríceps", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.65, met: 5.5,
    secundarios: ["Glúteos", "Posterior", "Core"],
    // Sem "agachamento" nem "agachamento livre": são apelidos do de barra, e
    // `casaBusca` já casa este pelo nome, que contém a palavra inteira.
    aliases: ["air squat", "agachamento sem peso"],
    instrucoes: [
      "Pés na largura dos ombros, pontas levemente para fora.",
      "Desça empurrando o quadril para trás, joelho acompanhando a linha do pé.",
      "Desça até a coxa passar da paralela, se o tornozelo deixar; suba pelo calcanhar.",
    ],
  },
  {
    nome: "Afundo sem peso", grupo: "Quadríceps", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.65, met: 5.5,
    secundarios: ["Glúteos", "Posterior"],
    // "afundo"/"avanço"/"lunge" são do afundo com halteres; o nome daqui já
    // contém "Afundo", que é por onde a busca acha.
    aliases: ["afundo sem peso", "avanço sem peso"],
    instrucoes: [
      "Passo à frente firme; o tronco fica ereto, não se inclina para a perna da frente.",
      "Desça até o joelho de trás quase tocar o chão.",
      "Volte empurrando o calcanhar da perna da frente.",
    ],
  },
  {
    nome: "Burpee", grupo: "Core", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.7, met: 8,
    secundarios: ["Peito", "Quadríceps", "Ombros"],
    aliases: ["burpees"],
    instrucoes: [
      "Do agachamento, jogue os pés para trás e caia na posição de flexão.",
      "Faça a flexão — ou pule ela, se o objetivo é ritmo — e volte os pés ao agachamento.",
      "Termine com um salto e as mãos acima da cabeça.",
    ],
  },
  {
    nome: "Polichinelo", grupo: "Panturrilha", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.15, met: 8,
    secundarios: ["Ombros"],
    aliases: ["jumping jack", "polichinelos"],
    instrucoes: [
      "Salte abrindo as pernas e levando as mãos acima da cabeça.",
      "Volte no mesmo salto, sem travar o joelho na aterrissagem.",
    ],
  },
  {
    nome: "Agachamento com salto", grupo: "Quadríceps", tipo: "composto",
    equipamento: "peso_corporal", fracao: 0.75, met: 8,
    secundarios: ["Glúteos", "Panturrilha"],
    aliases: ["jump squat", "agachamento pliométrico"],
    instrucoes: [
      "Agache até a coxa perto da paralela e salte com força.",
      "Aterrisse na ponta do pé e desça para o próximo agachamento absorvendo o impacto.",
    ],
  },
];
