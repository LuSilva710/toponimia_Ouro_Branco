

Ref_Presentation_API.md
Visão Geral
Esta camada expõe os endpoints da API. No SCFramework, a Controller não deve conter lógica de negócios complexa; sua função é:
Orquestrar Chamadas: Receber a requisição, validar tokens e chamar o Serviço.
Gerenciar Segurança: Verificar a identidade do usuário via Claims (Token JWT).
Padronizar Respostas: Envelopar todos os retornos em um objeto APIResponse com status HTTP adequados.
Tratamento de Exceções: Capturar erros não tratados no Serviço e retornar mensagens amigáveis (Error 500).

Passo 09: Controllers (API)
Caminho: src/API/Controllers/{SuaEntidade}Controller.cs
Regras de Ouro
Herança e Atributos: Herdar de ControllerBase, decorar com [ApiController] e [Route("[controller]")].
Identificação do Usuário:
Obrigatório: Recuperar o ID do usuário logado através de User.FindFirst(ClaimTypes.NameIdentifier).
Validação: Se o ID for nulo, retornar 401 Unauthorized imediatamente.
Injeção de Dependência: Injetar o Serviço (I{Entidade}Service), Logger (ILogPgService) e outros auxiliares (Excel/PDF).
Documentação: Obrigatório usar /// <summary> em todos os métodos da API (endpoints) para documentação no Swagger. A IA deve sempre colocar summary nos métodos do Swagger.
Padrão de Retorno (APIResponse):
Sucesso (200 OK): response.Success = true, response.Object = dados, response.Message = "Sucesso".
Erro de Negócio (400 Bad Request): Quando o Serviço retorna Result.IsFailed.
Erro Interno (500 Internal Server Error): No catch, logar o erro e retornar mensagem genérica.
Exemplo de Referência: LotsTicketController.cs
C#
using AiPass.Communication.ViewObjects.API; // APIResponse
using AiPass.Communication.ViewObjects.LotTicket; // VOs
using AiPass.Core.ServicesInterface.API; // Interfaces de Serviço
using AiPass.Helpers; // Mensagens constantes
using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;


namespace AiPass.API.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class LotsTicketController : ControllerBase
    {
        private readonly ILotTicketService _lotService;
        private readonly ILogPgService _logService;
        // Outros serviços injetados conforme necessidade (Excel, PDF, FormBuild)


        public LotsTicketController(ILotTicketService lotService, ILogPgService logService)
        {
            _lotService = lotService;
            _logService = logService;
        }


        /// <summary>
        /// Save - Salva ou edita os dados de um lote. ID = 0 (Salvar), ID > 0 (Editar).
        /// </summary>
        [HttpPost]
        [Route("Save")]
        public async Task<IActionResult> SaveLot([FromBody] LotTicketSaveVO model)
        {
            APIResponse response = new APIResponse();
            try
            {
                // 1. Validação de Segurança (Token JWT)
                Claim idUser = User.FindFirst(ClaimTypes.NameIdentifier);
                if (idUser == null || string.IsNullOrEmpty(idUser.Value))
                {
                    response.Success = false;
                    response.Message = ConstantsMessageUsers.ErrorUserNotFound;
                    return StatusCode(StatusCodes.Status401Unauthorized, response);
                }


                // 2. Chamada ao Serviço
                // Passa o ID do usuário para auditoria/permissões e flag de negócio (ex: hasTax = true)
                Result saveResult = await _lotService.SaveOrEditLot(model, idUser.Value, true);


                // 3. Tratamento de Erro de Negócio (400)
                if (saveResult.IsFailed)
                {
                    response.Message = saveResult.Errors.FirstOrDefault()?.Message;
                    response.Success = false;
                    response.Object = null;
                    return StatusCode(StatusCodes.Status400BadRequest, response);
                }


                // 4. Recuperação do Objeto Criado/Editado para Retorno
                int idLot = int.Parse(saveResult.Reasons.FirstOrDefault().Message); // ID vem no motivo do sucesso
                LotReturnVO data = await _lotService.GetLotById(idLot);


                // 5. Retorno de Sucesso (200)
                response.Success = true;
                response.Object = data;
                response.Message = model.Id == 0 ? ConstantsMessagesLotsTickets.SuccessSaveLot : ConstantsMessagesLotsTickets.SuccessUpdateLot;


                return StatusCode(StatusCodes.Status200OK, response);
            }
            catch (Exception ex)
            {
                // 6. Tratamento de Exceção Não Controlada (500)
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorSaveLot, this.GetType().ToString());


                response.Success = false;
                response.Message = ConstantsMessagesLotsTickets.ErrorSaveLot;
                response.Object = null;


                return StatusCode(StatusCodes.Status500InternalServerError, response);
            }
        }


        /// <summary>
        /// GetAllByEventSector - Retorna lista de lotes filtrados por Evento e Setor.
        /// </summary>
        [HttpGet]
        [Route("GetAllByEventSector")]
        public async Task<IActionResult> GetAllByEventSector([FromQuery] int eventId, int sectorId)
        {
            APIResponse response = new APIResponse();
            try
            {
                Claim idUser = User.FindFirst(ClaimTypes.NameIdentifier);
                if (idUser == null || string.IsNullOrEmpty(idUser.Value))
                {
                    response.Success = false;
                    response.Message = ConstantsMessageUsers.ErrorUserNotFound;
                    return StatusCode(StatusCodes.Status401Unauthorized, response);
                }


                var list = await _lotService.GetAllByEventSectorAsync(eventId, sectorId, idUser.Value);


                if (list == null)
                {
                    response.Success = false;
                    response.Message = ConstantsMessagesLotsTickets.ErrorGetAllGroupedSectorByEvent;
                    response.Object = new ListFrontVO<LotReturnVO>(); // Retorna lista vazia tipada
                    return StatusCode(StatusCodes.Status400BadRequest, response);
                }


                response.Success = true;
                response.Message = ConstantsMessagesLotsTickets.SuccessGetAllGroupedSectorByEvent;
                response.Object = list;


                return StatusCode(StatusCodes.Status200OK, response);
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorGetAllGroupedSectorByEvent, this.GetType().ToString());


                response.Success = false;
                response.Message = ConstantsMessagesLotsTickets.ErrorGetAllGroupedSectorByEvent;
                response.Object = new ListFrontVO<LotReturnVO>();


                return StatusCode(StatusCodes.Status500InternalServerError, response);
            }
        }


        /// <summary>
        /// Prepare - Prepara o formulário de lotes (carrega dados para edição).
        /// </summary>
        [HttpGet]
        [Route("Prepare")]
        public async Task<IActionResult> PrepareForm([FromQuery] int? LotId)
        {
            APIResponse response = new APIResponse();
            try
            {
                Claim idUser = User.FindFirst(ClaimTypes.NameIdentifier);
                if (idUser == null || string.IsNullOrEmpty(idUser.Value))
                {
                    response.Success = false;
                    response.Message = ConstantsMessageUsers.ErrorUserNotFound;
                    return StatusCode(StatusCodes.Status401Unauthorized, response);
                }
                
                // Validação de entrada: LotId é obrigatório para edição, mas pode ser null para criação se a lógica permitir
                if (LotId == null) 
                {
                     // Lógica específica se necessário, ou retornar erro
                }


                LotTicketSaveVO prepareData = await _lotService.PrepareForm(LotId.Value, idUser.Value);


                if (prepareData == null)
                {
                    response.Success = false;
                    response.Message = ConstantsMessagesLotsTickets.ErrorPrepare;
                    return StatusCode(StatusCodes.Status400BadRequest, response);
                }


                response.Success = true;
                response.Message = ConstantsMessagesLotsTickets.SuccessPrepareLot;
                response.Object = prepareData;


                return StatusCode(StatusCodes.Status200OK, response);
            }
            catch (Exception ex)
            {
                _logService.Write(ex.Message, ConstantsMessagesLotsTickets.ErrorPrepare, this.GetType().ToString());
                response.Success = false;
                response.Message = ConstantsMessagesLotsTickets.ErrorPrepare;
                return StatusCode(StatusCodes.Status500InternalServerError, response);
            }
        }
    }
}


Notas Finais
FormBuild e Export: O arquivo original (LotsTicketController.cs) mostra o uso avançado de IFormBuildService para renderização dinâmica de formulários e IExcelService/IPdfService para exportação. Se sua estória envolver UI dinâmica ou relatórios, siga o padrão dos métodos Build e ExportList do exemplo original.
Query Parameters: Utilize [FromQuery] para filtros em requisições GET.
Body Parameters: Utilize [FromBody] para objetos complexos em POST/PUT.



