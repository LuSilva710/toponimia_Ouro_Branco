01_Coding_Standards.md
1. Regras Sintáticas e de Estilo
Estas regras se aplicam a todos os arquivos C# do projeto.

PROIBIÇÃO DE var: O uso da palavra-chave var é estritamente proibido. Todos os tipos devem ser declarados explicitamente para garantir clareza imediata do tipo de dado manipulado.
Incorreto: var lista = new List<int>();
Correto: List<int> lista = new List<int>();
Nomenclatura: Siga as convenções de PascalCase para métodos e classes, e camelCase para variáveis locais e parâmetros, conforme padrão .NET, mas respeitando a tipagem explícita.

2. Tratamento de Erros e Logging
A robustez da aplicação depende de um tratamento de erros padronizado.
Blocos try/catch Obrigatórios: Todos os métodos nas camadas de Repositório, Serviço e Handlers (Controllers) devem ser encapsulados em blocos try/catch.
Logging: O bloco catch deve obrigatoriamente logar a exceção utilizando a injeção de ILogPgService (ou equivalente no contexto) antes de retornar.
Mensagens de Erro:
Nunca use strings literais para mensagens de erro ou sucesso (ex: "Erro ao salvar").
Sempre utilize a classe estática Helpers/ConstantsMessages.cs.
Fluxo de Exceção: Não relance a exceção (throw;) a menos que estritamente necessário. Prefira retornar um objeto Result.Fail com a mensagem padronizada1111.

3. Persistência e Banco de Dados (Entity Framework)
Regras críticas para integridade de dados e performance.
🚫 Deleção Física Proibida: Jamais execute comandos DELETE. A exclusão deve ser lógica:
Setar DisabledAt = DateTimeOffset.UtcNow;
Queries de leitura devem filtrar automaticamente: x => x.DisabledAt == null.
🚫 Enums são Proibidos: Não mapeie Enums no banco. Use o padrão de Tabela Domínio:
Propriedade: public int GenericTypeId { get; set; }
Navegação: public virtual GenericType GenericType { get; set; }.
Mapeamento (Fluent API):
Todas as configurações devem ficar em Infrastructure/Data/PgSql/EntitiesConfiguration.
Configurar cardinalidade explicitamente (HasOne, WithMany, HasForeignKey). Não confie na dedução automática do EF.
Use .OnDelete(DeleteBehavior.NoAction) para evitar cascades perigosos.
Entidades:
Devem herdar de BaseEntities.
Nunca declarar manualmente CreatedAt, UpdatedAt ou DisabledAt (herdados da base).
Toda Foreign Key (FK) deve ter sua propriedade de navegação virtual correspondente.

4. Value Objects (VOs) e Transferência de Dados
A separação entre entrada e saída é rígida.
VO de Entrada (Input)
Usado para Insert e Update.
Estrutura Achatada (Flat): Não deve conter objetos aninhados.
Referências: Para FKs, envie apenas os IDs (ex: DepartamentoId), nunca o objeto Departamento.
Relacionamentos N:N: Envie uma lista de inteiros (ex: List<int> CategoriaIds).
Proibido: Campos calculados, nomes de entidades relacionadas ou propriedades de auditoria (CreatedAt).
VO de Saída (ReturnVO)
Usado para GetById, GetAll.
Deve conter os dados da entidade + dados derivados necessários para a tela (ex: NomeDepartamento vindo da navegação).

5. Padrões de Camadas
Repositórios (Infrastructure)
Devem retornar Task<Result<T>> para operações de modificação ou Task<T>/Task<List<T>> para leituras222222222.
Em caso de falha no try/catch, retornar Result.Fail(ConstantsMessages.ErroX) ou null (para buscas).
Serviços (Core)
Responsáveis pelas regras de negócio e mapeamento (AutoMapper).
Nunca retornam a Entidade de Domínio diretamente para a Controller. Sempre convertem para VO.
Controllers (API)
Recuperação de Usuário: Sempre obter o ID do usuário logado via Claims: User.FindFirst(ClaimTypes.NameIdentifier)?.Value.
Retorno Padronizado: Sempre retornar um IActionResult encapsulando um APIResponse.
Exemplo Sucesso: return Ok(APIResponse.Ok(obj: result.Value));.
Utilize StatusCodes apropriados (200, 400, 404, 500).

6. Migrations
Comando Oficial: Add-Migration Nome -Project {Projeto}.Infrastructure -o Data/PgSql/Migrations.
Limpeza Obrigatória: Após gerar a migration, remova linhas contendo .Annotation("Npgsql:IdentitySequenceOptions", ...) antes de rodar o update.

7. Datas e Swagger (obrigatório para a IA)
Datas: Sempre mapear e formatar datas usando a classe estática Helpers/StaticMethods (ex.: StaticMethods.FormateDateTimeToPTBR). Não expor DateTime/DateTimeOffset brutos em VOs de retorno; usar sempre formatação via StaticMethods nos Profiles e nos serviços.
Swagger: Todo método de Controller exposto na API deve ter documentação XML com /// <summary> descrevendo o que o endpoint faz, para que o Swagger exiba a descrição corretamente.

