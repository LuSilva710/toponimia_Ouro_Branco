Ref_Infra_Data.md
Visão Geral
Esta camada é responsável por comunicar a aplicação com o Banco de Dados (PostgreSQL).
Seguimos o padrão Code First, onde as configurações das classes definem o esquema do banco.

Passo 02: Configuração da Entidade (Fluent API)
Caminho: Infrastructure/Data/PgSql/EntitiesConfiguration/{SuaEntidade}Configuration.cs
Nesta etapa, configuramos apenas as propriedades escalares (tamanhos, tipos, obrigatoriedade e valores padrão). As Chaves Estrangeiras (FKs) são configuradas preferencialmente no ApplicationDbContext ou aqui, se necessário.
Regras de Implementação
Interface: Implementar IEntityTypeConfiguration<{SuaEntidade}>.
Identidade: Configurar explicitamente o ID (HasIdentityOptions se necessário).
Defaults: Usar .HasDefaultValue(...) para booleanos ou números com valor inicial.
Strings: Sempre definir .HasMaxLength(N).
IsRequired: Definir explicitamente IsRequired(true) ou IsRequired(false).
Exemplo de Referência: LotTicketsConfiguration.cs
C#
using AiPass.Core.Entities.PgSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPass.Infrastructure.Data.PgSql.EntitiesConfiguration
{
    public class LotTicketsConfiguration : IEntityTypeConfiguration<LotTickets>
    {
        public void Configure(EntityTypeBuilder<LotTickets> builder)
        {
            // PK e Identidade
            builder.Property(x => x.Id).IsRequired(true).HasIdentityOptions(startValue: 1);

            // Strings e Obrigatoriedade
            builder.Property(x => x.Name).IsRequired(true).HasMaxLength(256);
            builder.Property(x => x.Description).IsRequired(false).HasMaxLength(256);

            // Datas
            builder.Property(x => x.SalesStartDate).IsRequired(true);
            builder.Property(x => x.SalesEndDate).IsRequired(true);

            // Valores Padrão
            builder.Property(x => x.IsFinishedLot).IsRequired(true).HasDefaultValue(false);
            builder.Property(x => x.TicketsSoldCount).IsRequired(true).HasDefaultValue(0);
            builder.Property(x => x.TicketPrice).IsRequired(true).HasDefaultValue(0);
            builder.Property(x => x.MaxTicketsNumberBuyer).IsRequired(true).HasDefaultValue(1);
            
            // Campos Nullables
            builder.Property(x => x.LotTax).IsRequired(false).HasDefaultValue(null);

            // FKs (Propriedades escalares)
            builder.Property(x => x.EventId).IsRequired(true);
            builder.Property(x => x.SectorId).IsRequired(true);
        }
    }
}



Passo 03: ApplicationDbContext
Caminho: Infrastructure/Data/PgSql/Context/ApplicationDbContext.cs
O Contexto orquestra os DbSet e define os relacionamentos complexos (1:N, 1:1) para evitar ciclos de exclusão (Cascade) indesejados.
Regras de Implementação
Herança: Deve herdar de IdentityDbContext<ApplicationUser, RoleUser, string>.
DbSet: Registrar a entidade criada: public DbSet<LotTickets> LotsTickets { get; set; }.
ApplyConfiguration: Registrar a classe de configuração criada no Passo 02 via builder.ApplyConfiguration(...).
Relacionamentos (OnModelCreating):
Usar DeleteBehavior.NoAction para evitar erros de ciclos em deleções.
Mapear explicitamente HasOne / WithMany / HasForeignKey.
Exemplo de Configuração no OnModelCreating
C#
protected override void OnModelCreating(ModelBuilder builder)
{
    base.OnModelCreating(builder);
    builder.UseIdentityAlwaysColumns();

    // ... Outras configurações ...

    // REGRA: Mapeamento de Relacionamentos (Evitar Cascade com NoAction)
    builder.Entity<LotTickets>()
            .HasOne(x => x.Sector)
            .WithMany(x => x.LotsTickets)
            .HasForeignKey(x => x.SectorId)
            .OnDelete(DeleteBehavior.NoAction);

    builder.Entity<LotTickets>()
            .HasOne(x => x.Event)
            .WithMany(x => x.LotsTickets)
            .HasForeignKey(x => x.EventId)
            .OnDelete(DeleteBehavior.NoAction);
            
    // Exemplo de Relacionamento 1:1 (Cascade permitido se for composição forte)
    builder.Entity<LotTickets>()
            .HasOne(lt => lt.LotPassport)
            .WithOne(lp => lp.Lot)
            .HasForeignKey<LotPassport>(lp => lp.LotId)
            .OnDelete(DeleteBehavior.Cascade);

    // REGRA: Aplicar a configuração das propriedades (Passo 02)
    builder.ApplyConfiguration(new LotTicketsConfiguration());
}



Passo 04: Migrations (Comandos)
Ferramenta: Package Manager Console (VS) ou Terminal.
O agente não gera o código C# da migration, mas deve instruir os comandos e a limpeza necessária.
Gerar Migration:
Add-Migration NomeDaFuncionalidade -Project {SeuProjeto}.Infrastructure -o Data/PgSql/Migrations.
Limpeza Obrigatória (Manual):
Abrir o arquivo .cs gerado na pasta Migrations.
Remover qualquer linha contendo: .Annotation("Npgsql:IdentitySequenceOptions", ...).
Isso evita conflitos de sequência no PostgreSQL.
Atualizar Banco:
Update-Database.

Passo 05-Impl: Implementação do Repositório
Caminho: Infrastructure/RepositoriesImpl/PgSql/{SuaEntidade}Repository.cs
Aqui reside a lógica de acesso a dados. A robustez é garantida pelo uso estrito de try/catch, Logs e AsNoTracking para leitura.
Regras de Implementação
Injeção: Injetar ApplicationDbContext e ILogPgService.
Sem var: Tipagem explícita obrigatória.
Leitura (Find):
Sempre filtrar x => x.DisabledAt == null.
Usar .Include() e .ThenInclude() para trazer dados relacionados necessários.
Otimização: Usar .AsNoTracking() em métodos que retornam listas ou objetos apenas para visualização.
Retornar null em caso de erro no catch.
Escrita (Insert/Update/Delete):
Retornar Result (FluentResults).
Insert: Setar Id = 0, CreatedAt = DateTime.Now, DisabledAt = null.
Delete: NUNCA usar .Remove(). Setar DisabledAt = DateTime.Now (Soft Delete).
Catch: Logar com _logService.Write e retornar Result.Fail(ConstantsMessages...).
Exemplo de Referência: LotTicketRepository.cs
C#
using AiPass.Core.Entities.PgSql;
using AiPass.Core.RepositoriesInterface.PgSql;
using AiPass.Helpers; // Onde ficam as ConstantsMessages
using AiPass.Infrastructure.Data.PgSql.Context;
using FluentResults;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AiPass.Infrastructure.RepositoriesImpl.PgSql
{
    public class LotTicketRepository : ILotTicketRepository
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogPgService _logService;

        public LotTicketRepository(ApplicationDbContext db, ILogPgService logService)
        {
            _db = db;
            _logService = logService;
        }

        // --- EXEMPLO DE INSERT ---
        public async Task<Result> InsertLotAsync(LotTickets lot)
        {
            try
            {
                // Regras de inicialização segura
                lot.Id = 0;
                lot.CreatedAt = DateTime.Now;
                lot.UpdatedAt = DateTime.Now;
                lot.DisabledAt = null;
                lot.TicketsSoldCount = 0; // Inicializa contadores

                _db.LotsTickets.Add(lot);
                await _db.SaveChangesAsync();

                // Retorna sucesso com o ID gerado
                return Result.Ok().WithSuccess(lot.Id.ToString());
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorSaveLot, this.GetType().ToString());
                return Result.Fail(ConstantsMessagesLotsTickets.ErrorSaveLot);
            }
        }

        // --- EXEMPLO DE UPDATE ---
        public async Task<Result> UpdateLotAsync(LotTickets lot)
        {
            try
            {
                // Para Update, NÃO usamos AsNoTracking, pois queremos rastrear as mudanças na entidade buscada
                LotTickets lotSaved = await _db.LotsTickets
                    .Where(x => x.Id == lot.Id && x.DisabledAt == null)
                    .FirstOrDefaultAsync();

                if (lotSaved == null)
                {
                    return Result.Fail(ConstantsMessagesLotsTickets.ErrorInvalidLot);
                }

                // Atualiza campos manualmente 
                lotSaved.Name = lot.Name;
                lotSaved.Description = lot.Description;
                lotSaved.TicketPrice = lot.TicketPrice;
                lotSaved.UpdatedAt = DateTime.Now; // Atualiza timestamp
                
                // Lógica de negócio simples permitida no repositório
                if (lotSaved.IsFinishedLot && lot.SalesEndDate > DateTime.Now)
                {
                     lotSaved.IsFinishedLot = false;
                }

                await _db.SaveChangesAsync();
                return Result.Ok().WithSuccess(lotSaved.Id.ToString());
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorUpdateLot, this.GetType().ToString());
                return Result.Fail(ConstantsMessagesLotsTickets.ErrorUpdateLot);
            }
        }

        // --- EXEMPLO DE DELETE (LÓGICO) ---
        public async Task<Result> DeleteAsync(int LotId)
        {
            try
            {
                LotTickets lot = await FindLotByIdAsync(LotId);

                if (lot == null)
                {
                    return Result.Fail(ConstantsMessagesLotsTickets.ErrorLotNotFound);
                }
                
                // Soft Delete
                lot.DisabledAt = DateTime.Now;
                lot.UpdatedAt = DateTime.Now;

                await _db.SaveChangesAsync();
                return Result.Ok();
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorDelete, this.GetType().ToString());
                return Result.Fail(ConstantsMessagesLotsTickets.ErrorDelete);
            }
        }

        // --- EXEMPLO DE FIND COM INCLUDES E ASNOTRACKING ---
        public async Task<LotTickets> FindLotByIdAsync(int lotId)
        {
            try
            {
                // Busca otimizada para leitura
                LotTickets lot = await _db.LotsTickets
                                       .AsNoTracking() // OTIMIZAÇÃO: Não rastrear objetos de leitura
                                       .Where(x => x.Id == lotId && x.DisabledAt == null)
                                       .Include(x => x.Sector)
                                       .Include(x => x.Event)
                                            .ThenInclude(x => x.Status)
                                       .Include(x => x.Event)
                                            .ThenInclude(x => x.Address)
                                       .FirstOrDefaultAsync();
                return lot;
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorFindById, this.GetType().ToString());
                return null;
            }
        }
        
        // --- EXEMPLO DE LISTAGEM ---
        public async Task<List<LotTickets>> FindAllLotsByEventIdAsync(int eventId)
        {
            try
            {
                List<LotTickets> lots = await _db.LotsTickets
                                             .AsNoTracking() // OTIMIZAÇÃO
                                             .Where(x => x.DisabledAt == null && x.EventId == eventId)
                                             .Include(x => x.Sector)
                                             .Include(x => x.SalesTickets)
                                             .ToListAsync();
                return lots;
            }
            catch (Exception ex)
            {
                 _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorGetAllLots, this.GetType().ToString());
                 return null;
            }
        }
    }
}



