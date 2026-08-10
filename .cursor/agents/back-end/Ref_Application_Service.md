Ref_Application_Service.md
Visão Geral
Esta camada é o cérebro da aplicação, atuando como o orquestrador entre a Interface (API) e o Domínio. No SCFramework, a Camada de Aplicação não é apenas um "repassador" de dados; ela possui responsabilidades críticas:
Contrato de Dados Rígido (VOs): Define exatamente o que entra e sai da API. Utiliza anotações poderosas (DataAnnotations e CustomAnnotations) para controlar não apenas a validação, mas também a renderização dinâmica de colunas e formulários no Front-end.
Blindagem do Domínio: Garante que apenas dados válidos cheguem às entidades.
Orquestração de Regras: Coordena múltiplos repositórios, serviços externos e cálculos complexos antes de persistir algo.
Tratamento de Exceções: Centraliza o try/catch com logs padronizados, garantindo que a API nunca quebre silenciosamente.

Passo 06: ViewObjects (VOs)
Caminho: src/Communication/ViewObjects/{SuaEntidade}/
Os VOs no SCFramework são Ricos. Eles não servem apenas para transportar dados, mas também carregam metadados que orientam o comportamento da interface (ordenação, visibilidade, labels) e validação.
Estrutura e Regras
1. VO de Entrada (SaveVO) - Insert/Update
Anotações de UI: Deve utilizar [OrderColumns], [ColumnView] e [NameColumn] para ditar como o campo aparece nas tabelas e grids do front-end.
Validação: Uso extensivo de [Required], [StringLength], [Range] com mensagens de erro amigáveis.
Estrutura Flat: Recebe IDs de relacionamentos (ex: EventId), nunca objetos aninhados.
Propriedades Calculadas: Pode conter lógicas simples de formatação para facilitar a visualização imediata (ex: IsHiddenStr).
2. VO de Saída (ReturnVO) - Get/List
Herança: Geralmente herda do SaveVO para reaproveitar as definições de metadados.
Dados de Exibição: Contém propriedades formatadas (string para Moeda/Data) e dados "achatados" de navegação (EventStr, SectorStr).
Flattening: Traz dados de entidades relacionadas para o nível raiz, evitando JSONs profundos.
Exemplo Robusto de Referência: LotTicketVO.cs
Abaixo, um exemplo completo demonstrando o uso de anotações personalizadas, validação e herança.
C#
using AiPass.Communication.CustomAnotations; // Anotações do Framework para UI
using System;
using System.ComponentModel.DataAnnotations; // Validações padrão .NET


namespace AiPass.Communication.ViewObjects.LotTicket
{
    // --- VO DE ENTRADA (WRITE) ---
    // Utilizado para Persistência (Save/Update) e geração de Form
    public class LotTicketSaveVO
    {
        [OrderColumns(1)]
        [ColumnView(Visible.True)]
        [NameColumn("Id do Lote")]
        public int Id { get; set; }


        [OrderColumns(2)]
        [ColumnView(Visible.True)]
        [NameColumn("Nome")]
        [Required(ErrorMessage = "É necessário informar um nome para o Lote")]
        [StringLength(256, ErrorMessage = "O nome deve ter no mínimo 3 caracteres e no máximo 256 caracteres", MinimumLength = 3)]
        public string Name { get; set; }


        [OrderColumns(3)]
        [ColumnView(Visible.True)]
        [NameColumn("Descrição")]
        [StringLength(256, ErrorMessage = "A descrição deve ter no mínimo 3 caracteres e no máximo 256 caracteres", MinimumLength = 3)]
        public string Description { get; set; }


        // Visible.Blocked indica que o campo existe mas pode estar travado ou oculto em certas views
        [ColumnView(Visible.Blocked)]
        [Required(ErrorMessage = "É necessário informar a data de início de vendas do Lote")]
        public DateTime SalesStartDate { get; set; }


        [ColumnView(Visible.Blocked)]
        [Required(ErrorMessage = "É necessário informar a data de fim das vendas do Lote")]
        public DateTime SalesEndDate { get; set; }


        [OrderColumns(4)]
        [ColumnView(Visible.True)]
        [NameColumn("Total de Ingressos")]
        [Required(ErrorMessage = "É necessário informar a quantidade de ingressos do Lote")]
        [Range(1, int.MaxValue, ErrorMessage = "A quantidade deve ser maior que 0")]
        public int TicketsNumberCount { get; set; }


        [OrderColumns(5)]
        [ColumnView(Visible.True)]
        [NameColumn("Mínimo de Ingressos por Comprador")]
        [Required(ErrorMessage = "Informe o Mínimo de Ingressos por Comprador")]
        [Range(1, int.MaxValue, ErrorMessage = "Digite um valor maior que 0")]
        public int MinTicketsNumberBuyer { get; set; }


        [OrderColumns(6)]
        [ColumnView(Visible.True)]
        [NameColumn("Máximo de Ingressos por Comprador")]
        [Required(ErrorMessage = "Informe o Máximo de Ingressos por Comprador")]
        [Range(1, int.MaxValue, ErrorMessage = "Digite um valor maior que 0")]
        public int MaxTicketsNumberBuyer { get; set; }


        [ColumnView(Visible.Blocked)]
        [Required(ErrorMessage = "Informe o valor do Ingresso")]
        [Range(0, double.MaxValue, ErrorMessage = "Digite um valor maior ou igual a 0")]
        public decimal TicketPrice { get; set; }


        // --- CHAVES ESTRANGEIRAS (Apenas IDs) ---
        [ColumnView(Visible.Blocked)]
        [Required(ErrorMessage = "É necessário informar à que evento o Lote pertence")]
        public int EventId { get; set; }


        [ColumnView(Visible.Blocked)]
        [Required(ErrorMessage = "É necessário informar à que Setor do Evento o Lote pertence")]
        public int SectorId { get; set; }


        // --- BOOLEANOS E LÓGICA DE APRESENTAÇÃO ---
        [ColumnView(Visible.Blocked)]
        public bool IsHidden { get; set; }


        [OrderColumns(7)]
        [ColumnView(Visible.True)]
        [NameColumn("Este lote é oculto?")]
        public string IsHiddenStr => IsHidden ? "Sim" : "Não"; // Propriedade calculada simples permitida


        [ColumnView(Visible.Blocked)]
        public bool HasTax { get; set; } = false;


        [ColumnView(Visible.Blocked)]
        public int? LotTax { get; set; }


        [OrderColumns(8)]
        [ColumnView(Visible.True)]
        [NameColumn("Valor da taxa")]
        public string LotTaxStr { get; set; } // Será preenchido pelo AutoMapper ou lógica de serviço


        [OrderColumns(9)]
        [ColumnView(Visible.True)]
        [NameColumn("Aceita troca de titularidade")]
        public bool IsAcceptChangeOwner { get; set; }


        [OrderColumns(10)]
        [ColumnView(Visible.True)]
        [NameColumn("É Passaporte?")]
        public bool IsPassport { get; set; }
    }


    // --- VO DE SAÍDA (READ) ---
    // Herda de SaveVO para manter metadados e adiciona campos formatados
    public class LotReturnVO : LotTicketSaveVO
    {
        [OrderColumns(11)]
        [ColumnView(Visible.True)]
        [NameColumn("Quantidade de Vendas")]
        public int TicketsSoldCount { get; set; }


        // --- STRINGS FORMATADAS (Preenchidas via AutoMapper/Helpers) ---
        
        [ColumnView(Visible.True)]
        [OrderColumns(12)]
        [NameColumn("Preço do Ingresso em R$")]
        public string TicketPriceStr { get; set; }


        [OrderColumns(13)]
        [ColumnView(Visible.True)]
        [NameColumn("Início das Vendas")]
        public string SalesStartDateStr { get; set; }


        [OrderColumns(14)]
        [ColumnView(Visible.True)]
        [NameColumn("Fim das Vendas")]
        public string SalesEndDateStr { get; set; }


        // --- DADOS ACHATADOS (FLATTENING) DE NAVEGAÇÃO ---
        
        [OrderColumns(15)]
        [ColumnView(Visible.False)] // Oculto mas disponível se necessário
        [NameColumn("Evento Associado")]
        public string EventStr { get; set; }


        [OrderColumns(16)]
        [ColumnView(Visible.False)]
        [NameColumn("Setor Associado")]
        public string SectorStr { get; set; }


        [OrderColumns(17)]
        [ColumnView(Visible.True)]
        [NameColumn("Status")]
        public string LotOpenClosed { get; set; } // "Aberto", "Fechado", "Esgotado"


        // --- CAMPOS CALCULADOS DE NEGÓCIO ---
        
        [ColumnView(Visible.True)]
        [NameColumn("Valor Líquido")]
        public string TicketPriceWithoutTaxStr { get; set; }


        [ColumnView(Visible.True)]
        [NameColumn("Valor da Taxa")]
        public string TicketTaxPriceStr { get; set; }


        [ColumnView(Visible.Blocked)]
        public bool IsEmbedTax { get; set; }


        [ColumnView(Visible.True)]
        [NameColumn("Possui Taxa Variável?")]
        public string HasTaxStr => HasTax ? "Não" : "Sim"; // Lógica inversa específica do negócio
    }
}

Passo 07: Serviços (Services)
A camada de serviço é responsável por orquestrar a lógica de negócios. No SCFramework, isso significa que o serviço deve:
Validar Permissões (Security): Verificar se o usuário tem a Role necessária para a operação (ex: Financeiro).
Garantir Integridade de Negócio: Não permitir alterações que quebrem o estado financeiro (ex: alterar taxas de um lote que já possui vendas).
Orquestrar Dependências: Buscar dados de Eventos, Usuários e Vendas para tomar decisões antes de chamar o Repositório de Lotes.
7.1 Interface de Serviço (ILotTicketService.cs)
Caminho: src/Core/ServicesInterfaces/API/ILotTicketService.cs
O contrato deve ser claro. Métodos de ação retornam Result (para sucesso/falha com mensagens) e métodos de leitura retornam VOs ricos ou listas formatadas para o front.
C#
using AiPass.Communication.ViewObjects.LotTicket;
using AiPass.Communication.ViewObjects.Utils;
using FluentResults;
using System.Collections.Generic;
using System.Threading.Tasks;


namespace AiPass.Core.ServicesInterface.API
{
    public interface ILotTicketService
    {
        // --- AÇÕES DE ESTADO (WRITE) ---
        // Recebe o ID do usuário para auditoria e verificação de permissões
        Task<Result> SaveOrEditLot(LotTicketSaveVO model, string idUser, bool hasTax);
        Task<Result> DeleteLot(int LotId, string idUser);
        
        // --- CONSULTAS E PREPARAÇÃO DE UI (READ) ---
        Task<LotReturnVO> GetLotById(int IdLot);
        Task<LotTicketSaveVO> PrepareForm(int LotId, string idUser);
        
        // Métodos auxiliares para montar Selects/Dropdowns no Front-end
        Task<InputRenderOptionsVO> GetBuildOptLots(string idUser, int? lotId = null);
        
        // Listagens Complexas com Agrupamento
        Task<List<ListGroupedFrontVO<LotReturnVO>>> GetAllGroupedSectorByEvent(int eventId, string idUser);
        Task<List<AvailableLotVO>> GetAllLotsAvailableForPurchase(int eventId, string decryptedHash);
        
        // Validações de Negócio Específicas
        Task<Result> VerifyTicketsCountInLot(int buyerTicketsCount, int LotId);
    }
}


7.2 Implementação Robusta (LotTicketsService.cs)
Caminho: src/Infrastructure/ServicesImpl/API/LotTicketsService.cs
Este exemplo reflete a realidade do projeto: múltiplas injeções, validação de roles (permissões), regras financeiras restritivas e tratamento de erros granular.
Regras Aplicadas:
Tipagem Explícita: List<string> em vez de var.
Fail Fast: Retornar erro assim que uma validação falhar.
Logs: _logService.Write em todos os catchs.
C#
using AiPass.Communication.ViewObjects.LotTicket;
using AiPass.Communication.ViewObjects.Utils; // Para SelectObjectVO, OptionsTypeVO
using AiPass.Core.Entities.PgSql;
using AiPass.Core.RepositoriesInterface.PgSql;
using AiPass.Core.ServicesInterface.API;
using AiPass.Helpers; // Onde vivem ConstantsMessages, ConstantsRoles, StaticMethods
using AutoMapper;
using FluentResults;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;


namespace AiPass.Infrastructure.ServicesImpl.API
{
    public class LotTicketsService : ILotTicketService
    {
        // Injeção de dependências para suportar a complexidade das regras
        private readonly ILotTicketRepository _lotRepo;
        private readonly IMapper _mapper;
        private readonly IApplicationUserRepository _userRepo;
        private readonly IEventRepository _eventRepo;
        private readonly IEventService _eventService; // Serviço cruzado permitido
        private readonly ILogPgService _logService;
        private readonly ISaleTicketRepository _saleTicketRepo; // Necessário para verificar vendas existentes


        public LotTicketsService(
            ILotTicketRepository lotRepo, 
            IMapper mapper, 
            IApplicationUserRepository userRepo, 
            IEventService eventService,
            ILogPgService logService, 
            IEventRepository eventRepo, 
            ISaleTicketRepository saleTicketRepo)
        {
            _lotRepo = lotRepo;
            _mapper = mapper;
            _userRepo = userRepo;
            _eventService = eventService;
            _logService = logService;
            _eventRepo = eventRepo;
            _saleTicketRepo = saleTicketRepo;
        }


        // --- MÉTODO COMPLEXO: SAVE/EDIT ---
        public async Task<Result> SaveOrEditLot(LotTicketSaveVO model, string idUser, bool hasTax)
        {
            try
            {
                // 1. Segurança: Verifica Usuário e Roles
                ApplicationUser userLogged = await _userRepo.GetByIdSimpleAsync(idUser);
                if (userLogged == null) return Result.Fail(ConstantsMessageUsers.ErrorUserNotFound);


                List<string> roles = await _userRepo.GetRoleUser(userLogged);
                // Verifica se é Financeiro ou Mind (Permissão Elevada)
                string role = roles.FirstOrDefault(x => x == ConstantsRoles.Financeiro || x == ConstantsRoles.Mind);


                // 2. Validação de Dependência: O Evento existe?
                Event eventData = await _eventRepo.FindById(model.EventId);
                if (eventData == null) return Result.Fail(ConstantsMessagesEvent.ErrorNotFound);


                // 3. Validação de Regras de Negócio (Datas, Valores) - Método Privado
                Result validateResult = ValidEntriesSaveEdit(model, eventData);
                if (validateResult.IsFailed) return validateResult;


                // 4. Mapeamento Inicial
                LotTickets lot = _mapper.Map<LotTickets>(model);


                // 5. Lógica de UPDATE com Travas de Negócio
                if (model.Id > 0)
                {
                    LotTickets lotSaved = await _lotRepo.FindLotByIdAsync(lot.Id);
                    
                    // REGRA DE NEGÓCIO: Apenas Financeiro pode alterar status de taxa (HasTax) de um lote existente
                    if (lotSaved != null && role == null)
                    {
                        // Se tentou mudar o HasTax sem permissão
                        if ((lotSaved.HasTax == false && hasTax == true) || (lotSaved.HasTax == true && hasTax == false))
                        {
                            return Result.Fail(ConstantsMessagesLotsTickets.ErrorDeleteLotNotTaxByRole);
                        }
                    }


                    // REGRA CRÍTICA: Não pode editar taxa se já existem vendas finalizadas
                    LotTickets lotWithSales = await _lotRepo.FindLotByIdAsyncSaleTicket(lot.Id);
                    List<SaleTicket> activeSales = lotWithSales.SalesTickets
                        .Where(x => x.FinalSaleValue != null && x.IsSaleFinalized == true && x.FinishedDate != null)
                        .ToList();


                    // Se tem vendas E tentou mudar o valor da taxa
                    if (activeSales.Count > 0 && lot.LotTax != null && lotSaved.LotTax != null && lotSaved.LotTax.Value != model.LotTax.Value)
                    {
                        return Result.Fail(ConstantsMessagesLotsTickets.ErrorEditLotTax);
                    }


                    // Travas de integridade (Campos imutáveis após criação)
                    if (lot.IsPassport != lotSaved.IsPassport)
                        return Result.Fail(ConstantsMessagesLotsTickets.ErrorEditLotPassport);


                    if (lot.IsAcceptChangeOwner != lotSaved.IsAcceptChangeOwner)
                        return Result.Fail(ConstantsMessagesLotsTickets.ErrorEditLotChangeOwner);


                    // Atualiza campos permitidos
                    lot.HasTax = model.HasTax; 
                    lot.UpdatedAt = DateTime.Now;


                    return await _lotRepo.UpdateLotAsync(lot);
                }
                // 6. Lógica de INSERT
                else
                {
                    lot.CreatedAt = DateTime.Now;
                    lot.UpdatedAt = DateTime.Now;
                    lot.DisabledAt = null;
                    lot.IsFinishedLot = false;
                    lot.Id = 0;
                    lot.HasTax = hasTax; // Define a taxa inicial


                    return await _lotRepo.InsertLotAsync(lot);
                }
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorSaveLot, this.GetType().ToString());
                return Result.Fail(ConstantsMessagesLotsTickets.ErrorSaveLot);
            }
        }


        // --- MÉTODO PRIVADO: Centraliza validações de campos e regras de data ---
        private Result ValidEntriesSaveEdit(LotTicketSaveVO model, Event eventData)
        {
            try
            {
                // Regra: Não criar lote retroativo se o evento não permitir
                if (!eventData.CanCreateLotAfterEventStarts)
                {
                    DateTime eventStart = eventData.StartDate.Value + eventData.StartTime.Value;
                    if (eventStart < model.SalesStartDate)
                    {
                        return Result.Fail(ConstantsMessagesEvent.ErrorCreateLotWithEventInitialized
                            .Replace("{{d}}", StaticMethods.ToDateHourFormat(eventStart)));
                    }
                }
                
                // Regra: Fim das vendas não pode ser após o fim do evento
                DateTime eventEnd = eventData.EndDate.Value + eventData.EndTime.Value;
                if (model.SalesEndDate > eventEnd)
                {
                    return Result.Fail(ConstantsMessagesEvent.ErrorCreateLotAfterEventIsFinished
                        .Replace("{{d}}", StaticMethods.ToDateHourFormat(eventEnd)));
                }


                // Regras básicas de consistência
                if (model.SalesStartDate < DateTime.Now && model.Id <= 0)
                    return Result.Fail(ConstantsMessagesLotsTickets.ErrorSalesStartInvalid);


                if (model.SalesEndDate < model.SalesStartDate)
                    return Result.Fail(ConstantsMessagesLotsTickets.ErrorSalesEndInvalid);


                if (model.MinTicketsNumberBuyer > model.MaxTicketsNumberBuyer)
                    return Result.Fail(ConstantsMessagesLotsTickets.ErrorMinMaxTickets);


                if (model.LotTax < 0 || model.LotTax > 100)
                    return Result.Fail(ConstantsMessagesLotsTickets.ErrorLotTaxPercent);


                return Result.Ok();
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorValidateEntries, this.GetType().ToString());
                return Result.Fail(ConstantsMessagesLotsTickets.ErrorValidateEntries);
            }
        }


        // --- MÉTODO READ: Preparação de Opções para o Front-end ---
        public async Task<InputRenderOptionsVO> GetBuildOptLots(string idUser, int? lotId = null)
        {
            InputRenderOptionsVO inputRender = new InputRenderOptionsVO();
            try
            {
                ApplicationUser user = await _userRepo.GetByIdSimpleAsync(idUser);
                if (user == null) return null;


                List<string> roles = await _userRepo.GetRoleUser(user);


                // Busca todos os eventos com dados relacionados necessários para filtro
                List<Event> eventsList = await _eventRepo.FindAllAsyncIncludingLotsTicketsAndSectors();
                
                // Filtra eventos baseado nas roles do usuário (Regra de Visibilidade)
                eventsList = _eventService.FilterEventsByUserRoles(user, roles, eventsList);


                // Mapeia para VO para manipulação segura
                List<EventVO> eventVOs = _mapper.Map<List<EventVO>>(eventsList);


                // Aplica filtros de negócio para exibição no dropdown
                eventVOs = eventVOs
                                .Where(x => x.Sectors.Count > 0 && 
                                            (x.StatusId == ConstantsEventStatusId.Active || x.StatusId == ConstantsEventStatusId.Hidden) &&
                                            x.StartDate <= x.EndDate &&
                                            (x.StartDate >= DateTime.Now || x.CanCreateLotAfterEventStarts == true) &&
                                            x.IsDraft == false) 
                                .Distinct()
                                .OrderBy(x => x.Title)
                                .ToList();


                List<SelectObjectVO> selects = _mapper.Map<List<SelectObjectVO>>(eventVOs);


                // Caso seja edição, garante que o evento atual esteja na lista mesmo que as regras tenham mudado
                if (lotId != null)
                {
                    LotTickets lotData = await _lotRepo.FindLotByIdAsync(lotId.Value);
                    SelectObjectVO select = _mapper.Map<SelectObjectVO>(lotData.Event);
                    selects.Add(select);
                    selects = selects.Distinct().OrderBy(x => x.Label).ToList();
                }


                // Monta o objeto de retorno esperado pelo front dinâmico
                inputRender.optionsTypeVOs.Add(new OptionsTypeVO()
                {
                    Name = "eventId",
                    selectObjects = selects 
                });


                return inputRender;
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorGetAllBuildOptions, this.GetType().ToString());
                // Retorna lista vazia em caso de erro para não quebrar a tela
                inputRender.optionsTypeVOs.Add(new OptionsTypeVO() { Name = "eventId", selectObjects = new List<SelectObjectVO>() });
                return inputRender; 
            }
        }
    }
}

Passo 08: Profiles de Mapeamento (AutoMapper)
Caminho: src/Core/Profiles/{SuaEntidade}Profile.cs
O AutoMapper no SCFramework não serve apenas para copiar propriedades de A para B. Ele atua como uma Camada de Apresentação Lógica. É aqui que transformamos dados brutos (Datas, Decimais, IDs) em informações legíveis para o usuário final (Strings formatadas, Nomes concatenados, Status descritivos).
Regras de Implementação
Centralização de Formatação: Nunca formate datas ou moedas na Controller ou no Service. Use o Profile com helpers estáticos (StaticMethods).
Flattening (Achatamento): Se o VO precisa mostrar o "Nome do Evento", mapeie diretamente da navegação da entidade (Event.Title) para a propriedade plana do VO (EventStr).
ReverseMap: Utilize .ReverseMap() para VOs de Edição (SaveVO), permitindo carregar o formulário com dados do banco.
Lógica Ternária: Pequenas lógicas visuais (ex: Aberto/Fechado) devem ficar no Profile para não poluir o Service.
Exemplo Robusto: LotTicketProfile.cs
C#
using AiPass.Communication.ViewObjects.LotTicket;
using AiPass.Communication.ViewObjects.Utils; // Para SelectObjectVO
using AiPass.Core.Entities.PgSql;
using AiPass.Helpers; // Onde ficam os StaticMethods
using AutoMapper;
using System;


namespace AiPass.Core.Profiles
{
    public class LotTicketProfile : Profile
    {
        public LotTicketProfile() 
        {
            // 1. Entity <-> Entity
            // Útil para clonagem ou atualizações parciais onde mapeamos DTOs internos
            CreateMap<LotTickets, LotTickets>()
                .ReverseMap();


            // 2. SaveVO <-> Entity
            // Usado no SaveOrEditLot (Input) e PrepareForm (Load)
            CreateMap<LotTicketSaveVO, LotTickets>()
                .ReverseMap();


            // 3. Entity -> ReturnVO (Read)
            // A mágica da formatação acontece aqui
            CreateMap<LotTickets, LotReturnVO>()
                // Formatação de Datas (Padrão PT-BR explícito)
                .ForMember(dest => dest.SalesStartDateStr, opt => opt.MapFrom(src => src.SalesStartDate.ToString("dd/MM/yyyy HH:mm:ss")))
                .ForMember(dest => dest.SalesEndDateStr, opt => opt.MapFrom(src => src.SalesEndDate.ToString("dd/MM/yyyy HH:mm:ss")))
                
                // Flattening: Concatenando dados de navegação (Event + Status)
                .ForMember(dest => dest.EventStr, opt => opt.MapFrom(src => src.Event.Title + " - " + src.Event.Status.Name))
                .ForMember(dest => dest.SectorStr, opt => opt.MapFrom(src => src.Sector.Name))
                
                // Uso de StaticMethods para formatação monetária padrão
                .ForMember(dest => dest.TicketPriceStr, opt => opt.MapFrom(src => StaticMethods.FormateToMonetary(src.TicketPrice)))
                
                // Lógica de Apresentação (Visual Logic)
                .ForMember(dest => dest.LotOpenClosed, opt => opt.MapFrom(src => src.IsFinishedLot ? "Fechado" : "Aberto"))
                
                // Mapeamento condicional complexo
                .ForMember(dest => dest.LotTaxStr, opt => opt.MapFrom(src => src.LotTax != null && src.HasTax == false ? $"{src.LotTax.Value}%" : $"{src.Event.TaxValue}%" ))
                
                // Dados herdados da navegação
                .ForMember(dest => dest.IsEmbedTax, opt => opt.MapFrom(src => src.Event.IsEmbedTax))
                
                .ReverseMap();


            // 4. Entity -> SelectObjectVO
            // Padrão para preencher Dropdowns/Comboboxes no Front-end
            CreateMap<LotTickets, SelectObjectVO>()
                .ForMember(dest => dest.Label, opt => opt.MapFrom(src => src.Name))
                .ForMember(dest => dest.Value, opt => opt.MapFrom(src => src.Id))
                .ReverseMap();


            // 5. Mapeamentos Específicos (Ex: AvailableLotVO para vitrine de vendas)
            CreateMap<LotTickets, AvailableLotVO>()
                .ForMember(dest => dest.LotId, opt => opt.MapFrom(src => src.Id))
                .ForMember(dest => dest.TicketPriceStr, opt => opt.MapFrom(src => StaticMethods.FormateToMonetary(src.TicketPrice)))
                .ForMember(dest => dest.TicketAvailableCount, opt => opt.MapFrom(src => src.TicketsNumberCount - src.TicketsSoldCount))
                .ForMember(dest => dest.IsEmbedTaxStr, opt => opt.MapFrom(src => src.Event.IsEmbedTax ? "Sim" : "Não"))
                // ... outros mapeamentos
                .ReverseMap();
        }
    }
}
