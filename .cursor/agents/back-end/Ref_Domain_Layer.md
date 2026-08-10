Ref_Domain_Layer.md
Visão Geral
Esta camada contém o coração do negócio. Ela deve ser pura, sem dependências de frameworks externos (exceto anotações de banco necessárias e tipos básicos).
Aqui definimos:
Entidades: O reflexo das tabelas do banco de dados.
Interfaces de Repositório: Os contratos que a camada de Infraestrutura deve cumprir.

Passo 01: Entidades (Entities)
Caminho: src/Core/Entities/PgSql/{SuaEntidade}/
Regras de Ouro para Entidades
Herança: Todas as entidades DEVEM herdar de BaseEntities.
Mapeamento de Colunas: Utilizar sempre [Column("nome_snake_case")] em todas as propriedades.
Propriedades de Auditoria: NUNCA declarar CreatedAt, UpdatedAt ou DisabledAt. Elas já são herdadas de BaseEntities.
Relacionamentos (FKs):
Deve conter a propriedade do ID (ex: SectorId).
Deve conter a propriedade de Navegação marcada como virtual (ex: public virtual Sector Sector { get; set; }).
Construtores: Use construtores vazios ou propriedades públicas com get; set;.
Exemplo de Referência: LotTickets.cs
C#
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
// Note: BaseEntities geralmente está num namespace comum, adicione o using se necessário.

namespace AiPass.Core.Entities.PgSql
{
    // REGRA: Herdar de BaseEntities
    public class LotTickets : BaseEntities
    {
        // REGRA: Mapeamento explícito da coluna ID
        [Column("id")]
        public int Id { get; set; }

        [Column("name")]
        public string Name { get; set; }

        [Column("description")]
        public string Description { get; set; }

        [Column("sales_start_date")]
        public DateTime SalesStartDate { get; set; }

        [Column("sales_end_date")]
        public DateTime SalesEndDate { get; set; }

        [Column("tickets_number")]
        public int TicketsNumberCount { get; set; }

        [Column("tickets_sold")]
        public int TicketsSoldCount { get; set; }

        [Column("ticket_price")]
        public decimal TicketPrice { get; set; }

        [Column("is_finished_lot")]
        public bool IsFinishedLot { get; set; }

        // --- RELACIONAMENTOS (Foreign Keys) ---
        
        // 1. A chave estrangeira explícita
        [Column("sector_id")]
        public int SectorId { get; set; }

        [Column("event_id")]
        public int EventId { get; set; }

        // Outros campos primitivos...
        [Column("max_tickets_number_buyer")]
        public int MaxTicketsNumberBuyer { get; set; }

        [Column("min_tickets_number_buyer")]
        public int MinTicketsNumberBuyer { get; set; }

        // Nullable types são permitidos onde faz sentido
        [Column("lot_tax")]
        public int? LotTax { get; set; } = null;

        [Column("is_hidden")]
        public bool IsHidden { get; set; }

        [Column("has_tax")]
        public bool HasTax { get; set; }

        [Column("is_accept_change_owner")]
        public bool IsAcceptChangeOwner { get; set; }

        [Column("is_passport")]
        public bool IsPassport { get; set; }

        // --- NAVEGAÇÃO VIRTUAL (Obrigatório para o EF Core) ---
        public virtual Sector Sector { get; set; }
        public virtual Event Event { get; set; }
        
        // Exemplo de relacionamento 1:N
        public virtual List<SaleTicket> SalesTickets { get; set; }
        
        // Exemplo de relacionamento 1:1
        public virtual LotPassport LotPassport { get; set; }
    }
}



Passo 05 (Parte A): Interface de Repositório
Caminho: src/Core/RepositoriesInterfaces/PgSql/
Regras para Interfaces
Dependências: Deve utilizar FluentResults para retornos de ações (Insert/Update/Delete).
Assincronismo: Todos os métodos devem ser Task ou Task<T>.
Padrão de Retorno:
Escrita (Insert/Update/Delete): Retorna Task<Result>.
Leitura (Get/Find): Retorna a Entidade (Task<LotTickets>) ou Lista (Task<List<LotTickets>>).
Assinatura: No padrão deste projeto, os métodos na interface levam o modificador public explicitamente (embora opcional no C#, manteremos para consistência com o exemplo).
Exemplo de Referência: ILotTicketRepository.cs
C#
using AiPass.Core.Entities.PgSql;
using FluentResults;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AiPass.Core.RepositoriesInterface.PgSql
{
    public interface ILotTicketRepository
    {
        // --- MÉTODOS DE ESCRITA (Result) ---
        public Task<Result> InsertLotAsync(LotTickets lot);
        public Task<Result> UpdateLotAsync(LotTickets lot);
        public Task<Result> DeleteAsync(int LotId); // Deleção Lógica
        
        // Métodos específicos de negócio que alteram estado
        public Task<Result> FinalizeLotById(int LotId);
        public Task<Result> UpdateLotTicketSoldAsync(int lotId, int ticketSold);

        // --- MÉTODOS DE LEITURA (Entidade/Lista) ---
        
        // Busca simples por ID
        public Task<LotTickets> FindLotByIdAsync(int lotId);
        
        // Busca com includes específicos (ex: com dados de vendas)
        public Task<LotTickets> FindLotByIdAsyncSaleTicket(int lotId);
        
        // Busca que ignora o filtro global de 'DisabledAt' (se necessário)
        public Task<LotTickets> FindLotByIdWithDisabledsAsync(int lotId);
        
        // Buscas em Lista
        public Task<List<LotTickets>> FindAllLotsByEventIdAsync(int eventId);
        public Task<List<LotTickets>> FindAllLotsAsync();
        
        // Buscas com múltiplos parâmetros
        public Task<List<LotTickets>> FindAllLotsByEventAndSector(int eventId, int sectorId);
        public Task<List<LotTickets>> FindAllAvailableLotsByEventAndSector(int eventId, int sectorId);
        
        // Buscas específicas
        public Task<List<Event>> GetAllEventsWithLots();
        public Task<int> FindLotTicketSoldCountAsync(int lotId);
        public Task<List<LotTickets>> FindAllHiddenLotByEventIdAsync(int eventId);
        public Task<LotTickets> FindHiddenLotByIdAsync(int lotId);
        public Task<List<LotTickets>> FindAllLotNotTaxByEventIdAsync(int eventId, int? sectorId = null);
    }
}




