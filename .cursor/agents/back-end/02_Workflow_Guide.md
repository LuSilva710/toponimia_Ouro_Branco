02_Workflow_Guide.md
Visão Geral do Fluxo
Este guia define a sequência obrigatória para a criação de funcionalidades (CRUD ou regras de negócio) dentro do SCFramework. O agente deve seguir esta ordem linearmente para garantir a integridade das dependências (ex: não criar o Controller antes de ter o Serviço).
Referência Cruzada: Para detalhes de implementação de cada camada, consulte os arquivos Ref_*.md específicos citados em cada passo.

Fase 1: Domínio e Persistência (Back-end Core)
Passo 01: Entidade (Domain)
Local: src/Core/Entities/PgSql/{SuaEntidade}/
Arquivo: {SuaEntidade}.cs
Ação: Criar a classe herdando de BaseEntities.
Regras Chave:
Mapear colunas com [Column("nome_coluna")].
Propriedades de navegação devem ser virtual.
Não adicionar CreatedAt, UpdatedAt, DisabledAt (já estão na base).
Detalhes em: Ref_Domain_Layer.md
Passo 02: Configuração (Infrastructure)
Local: Infrastructure/Data/PgSql/EntitiesConfiguration
Arquivo: {SuaEntidade}Configuration.cs
Ação: Implementar IEntityTypeConfiguration<{SuaEntidade}>.
Regras Chave:
Definir nome da tabela, tamanhos (HasMaxLength) e obrigatoriedade (IsRequired).
Configurar relacionamentos (FKs) explicitamente (HasOne, WithMany) e definir OnDelete(DeleteBehavior.NoAction).
Detalhes em: Ref_Infra_Data.md
Passo 03: Contexto de Banco de Dados (Infrastructure)
Local: Infrastructure/Data/PgSql/Context/ApplicationDbContext.cs
Ação:
Adicionar public DbSet<{SuaEntidade}> {SuaEntidade}s { get; set; }.
Garantir que a configuração (Passo 02) seja aplicada (geralmente via ApplyConfigurationsFromAssembly).
Passo 04: Migrations (Infrastructure)
Ferramenta: Package Manager Console ou CLI.
Ação 1 (Gerar): Add-Migration {Nome} -Project {Projeto}.Infrastructure -o Data/PgSql/Migrations.
Ação 2 (Limpar): Abrir o arquivo gerado e remover linhas contendo .Annotation("Npgsql:IdentitySequenceOptions", ...).
Ação 3 (Aplicar): Update-Database.
Passo 05: Repositório (Core & Infrastructure)
5.1 Interface:
Local: Core/RepositoriesInterfaces/PgSql/I{SuaEntidade}Repository.cs
Regra: Definir contratos retornando Task<Result<T>> ou Task<T>.
5.2 Mensagens (Helpers):
Local: Helpers/ConstantsMessages.cs
Ação: Criar constantes estáticas para erros e sucessos específicos desta entidade.
5.3 Implementação:
Local: Infrastructure/RepositoriesImpl/PgSql/{SuaEntidade}Repository.cs
Regra: Herdar de Repository<{SuaEntidade}> (ou FilterRepository).
Obrigatório: Usar try/catch, Logar erros com _log.Write e retornar constantes via Result.
Detalhes em: Ref_Infra_Data.md

Fase 2: Aplicação e Exposição (Application & API)
Passo 06: ViewObjects (Communication)
Local: src/Communication/ViewObjects/{SuaEntidade}/
Arquivo A (Input): {SuaEntidade}VO.cs (Para Insert/Update).
Regra: Estrutura plana, apenas IDs para FKs, sem objetos aninhados.
Arquivo B (Output): Return{SuaEntidade}VO.cs (Para Get/List).
Regra: Incluir descrições, nomes de relacionamentos e dados para exibição.
Detalhes em: Ref_Application_Service.md
Passo 07: Serviços (Core & Infrastructure)
7.1 Interface:
Local: Core/ServicesInterfaces/API/I{SuaEntidade}Service.cs
Regra: Métodos como SaveAsync, DeleteAsync, GetAllAsync, GetByIdAsync.
7.2 Implementação:
Local: Infrastructure/ServicesImpl/PgSql/{SuaEntidade}Service.cs
Ação: Injetar Repositório, Mapper e Logger.
Lógica: Validar regras de negócio, mapear Entity <-> VO, tratar erros com try/catch e retornar Result.
Detalhes em: Ref_Application_Service.md
Passo 08: AutoMapper (Core)
Local: Core/Profiles/{SuaEntidade}Profile.cs
Ação: Criar mapeamentos:
CreateMap<{SuaEntidade}, {SuaEntidade}VO>().ReverseMap();
CreateMap<{SuaEntidade}, Return{SuaEntidade}VO>();.
Passo 09: Controller (API)
Local: API/Controllers/{SuaEntidade}Controller.cs
Ação: Criar endpoints ([HttpGet], [HttpPost], etc.).
Regras Chave:
Recuperar usuário via User.FindFirst(ClaimTypes.NameIdentifier).
Retornar Ok(APIResponse.Ok(...)) ou BadRequest(APIResponse.Fail(...)).
Documentar com Swagger (XML comments).
Detalhes em: Ref_Presentation_API.md
Passo 10: Injeção de Dependência (API)
Local: Arquivos de Startup/Program/Extensions (ex: AddRepositoriesStartup.cs, AddServicesStartup.cs).
Ação: Registrar interfaces e implementações (Scoped) e adicionar o Profile do AutoMapper.

Lista de Verificação Final (Definition of Done)
Antes de considerar a tarefa concluída, verifique:
[ ] Algum var foi utilizado? (Se sim, corrigir).
[ ] Todas as mensagens são constantes de ConstantsMessages?
[ ] A migration foi limpa (IdentitySequenceOptions removido)?
[ ] Todos os métodos de IO (Banco) têm try/catch com log?
[ ] O VO de entrada contém apenas IDs para relacionamentos?

Próximo passo sugerido: Criar os arquivos de Referência Técnica (Ex: Ref_Domain_Layer.md) para conter os exemplos de código citados acima.

