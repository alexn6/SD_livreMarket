var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;
var _ = require("underscore");
var StateMachineHistory = require('javascript-state-machine/lib/history')

var PublicacionesJssm = require('javascript-state-machine').factory({
  init: 'compraGenerada',
  transitions: [
    {name:'reservarProducto',          from:'compraGenerada',                                  to:'resolviendoStock'},
    {name:'resolverStock',             from:'resolviendoStock',                                to:'stockResuelto'},
    // mensaje que llega async desde infracciones no garantiza orden de llegada respecto del resto (pago y agenda)
    {name:'informarInfraccion',        from:'*',                                               to:'infraccionInformada'},
    // mensaje que llega async desde pagos no garantiza orden de llegada respecto del resto (infracción y agenda)
    {name:'informarPagoAutorizado',    from:'*',                                               to:'pagoInformado'},
    // mensaje que llega asyn desde envíos no garantiza orden de llegada respecto del resto (infracción y pagos)
    {name:'informarAgendaEnvio',       from:'*',                                               to:'agendaInformada'},
    {name:'liberarProducto',           from:['infraccionInformada','stockResuelto'
                                            ,'pagoInformado'],                                 to:'productoLiberado'},
    //confirmar producto es punto de sincronización de los 3 mensajes async (infracciones, pagos, agenda)
    {name:'confirmarProducto',         from:'*',                                               to:'productoConfirmado'},
    {name:'entregarProducto',          from:'productoConfirmado',                              to:'productoEntregado'}
  ],

  data: {
    compra: new Object(),
    stepsQ: new Array()
  },

  plugins: [
      new StateMachineHistory()     //  <-- plugin enabled here
  ],

  methods: {

    onTransition: function (lifeCycle,data) {
      // console.log('onTransition transition: ',lifeCycle.transition);
      // console.log('onTransition from: ',lifeCycle.from);
      // console.log('onTransition to: ',lifeCycle.to);
      // console.log('onTransition data: ',data);
      console.log('onTransition history: ',this.history);
    },


    /**
     * anonymous function - accion inicial de este servidor caundo le
     * llega el mensaje de reservar producto desde el servidor de compras
     *
     * @param  {type} lifeCycle   información de la FSM
     * @param  {type} data        mensaje enviado por compras con datos de la compra
     * @return {string colection} proxima acción a ejecutar
     */
    onReservarProducto: function (lifeCycle,data) {
      //console.log('onDetectarPublicaciones: data --> ',data);
      this.compra = data;
      return ['resolverStock'];
    },


    /**
     * informarInfraccion - procesa el mensaje enviado por infracciones para
     * la compra.
     * IMPORTANTE: sin no hay infracción manda al punto de sincronización. Esto es
     * porque se espera ahí que TODOS las otras acciones se hayan ejecutado.
     * Misma situación para cancelar. Nótese que igualmente se coloca una guarda
     * verificando que el producto no haya sido liberado por otra acción --> CONSISTENCIA
     *
     * @param  {type} lifeCycle    información de la FSM
     * @param  {type} data         mensaje enviado desde infracciones
     * @return {string collection} proxima acción a ejecutar o false si no hay acción
     */
     onInformarInfraccion: function (lifeCycle,data) {
       // primero verifico que no haya sido YA liberado el producto,
       // conseciencia de otro mensaje de otro servidor. Async!!!
       if (_.contains(this.history,'productoLiberado')) {
         // si ya fue liberado no hago nada ni doy error.
         // La compra ya esta en estado terminal.
         console.log("El producto ya fue liberado: nose hace nada");
         return false;
       }

       this.compra.hasInfraccion = _.pick(data,'hasInfraccion').hasInfraccion;
       if (this.compra.hasInfraccion) {
         console.log("COMPRA_CON_INFRACCION --> liberarProducto()");
         return ['liberarProducto'];
       } else {
         return ['confirmarProducto'];
       }
     },


    /**
     * informarPagoAutorizado - comportamiento similar al de infracciones.
     * Mimso parámetros y return
     *
     * @param  {type} lifeCycle description
     * @param  {type} data      description
     * @return {type}           description
     */
    onInformarPagoAutorizado: function (lifeCycle,data) {
      // primero verifico que no haya sido YA liberado el producto,
      // conseciencia de otro mensaje de otra servidor. Async!!!
      if (_.contains(this.history,'productoLiberado')) {
        // si ya fue liberado no hago nada ni doy error.
        // La compra ya esta en estado terminal.
        console.log("El producto ya fue liberado: nose hace nada");
        return false;
      }

      // actualiza la forma de entrega del producto
      this.compra.formaEntrega = _.pick(data,'formaEntrega').formaEntrega;

      this.compra.pagoAutorizado = _.pick(data,'pagoAutorizado').pagoAutorizado;
      if (this.compra.pagoAutorizado) {
        return ['confirmarProducto'];
      } else {
        return ['liberarProducto'];
      }
    },


    /**
     * informarAgendaEnvio - simplemente registra la fecha de envío en la compra
     * luego simplemente ejecuta la próxima acciíon que es confirmar la compra, que
     * es el punto de sync de este servidor
     *
     * @param  {type} lifeCycle infomación de la FSM
     * @param  {JSON} data      mensaje envaido por envíos
     * @return {string collection} próxima acción o false (no action)
     */
    onInformarAgendaEnvio: function (lifeCycle,data) {
      // primero verifico que no haya sido YA liberado el producto,
      // conseciencia de otro mensaje de otra servidor. Async!!!
      if (_.contains(this.history,'productoLiberado')) {
        // si ya fue liberado no hago nada ni doy error.
        // La compra ya esta en estado terminal.
        console.log("El producto ya fue liberado: nose hace nada");
        return false;
      }

      // actualiza la forma de entrega del producto
      this.compra.formaEntrega = _.pick(data,'formaEntrega').formaEntrega;
      this.compra.agendaEnvio = _.pick(data,'agendaEnvio').agendaEnvio;
      return ['confirmarProducto'];
    },


    /**
     * resolverStock - simula la existencia o no de stock para el producto.
     * En caso de sel positivo va a confirmar que es punto de syncronización del
     * la compra para este servidor. Sino libera producto (final state)
     *
     * @param  {type} lifeCycle description
     * @param  {type} data      description
     * @return {type}           description
     */
    onResolverStock: function (lifeCycle,data) {
      // primero verifico que no haya sido YA liberado el producto,
      // conseciencia de otro mensaje de otra servidor. Async!!!
      if (_.contains(this.history,'productoLiberado')) {
        // si ya fue liberado no hago nada ni doy error.
        // La compra ya esta en estado terminal.
        console.log("ERROR!!! ---> El producto fue liberado");
        return false;
      }

      // this.compra.stock = Math.random() > 0.7 ? false : true;
      this.compra.stock = true;
      if (!this.compra.stock) {
        console.log("ERROR!! --> No hay stock disponible del producto");
        return ['liberarProducto'];
      } else {
        return ['confirmarProducto'];
      }
    },


    /**
     * liberarProducto - simplemente registra en compra el motivo y termina.
     * Termina cambia FSM a estado final.
     *
     * @param  {type} lifeCycle description
     * @param  {type} data      description
     * @return {type}           description
     */
    onLiberarProducto: function (lifeCycle,data) {
      // ************************** agregado por mi ************************
      this.compra.hasInfraccion = _.pick(data,'hasInfraccion').hasInfraccion;
      this.compra.pagoAutorizado = _.pick(data,'pagoAutorizado').pagoAutorizado;
      this.compra.stock = _.pick(data,'stock').stock;
      // *******************************************************************
      if ((typeof(this.compra.hasInfraccion) != 'undefined')&&(this.compra.hasInfraccion)) {
        this.compra.motivoLiberacion = '- Compra con infracción';
        console.log("LberarProducto() --> se detecto una INFRACCION");
      }
      if ((typeof(this.compra.pagoAutorizado) != 'undefined')&&(!this.compra.pagoAutorizado)) {
        this.compra.motivoLiberacion += '- Pago rechazado';
        console.log("LberarProducto() --> PAGO RECHAZADO: "+this.compra.pagoAutorizado);
      }
      if ((typeof(this.compra.stock) != 'undefined')&&(!this.compra.stock)) {
        this.compra.motivoLiberacion += '- Producto sin stock';
        console.log("LberarProducto() --> no hay STOCK");
      }

      return false;
    },


    /**
     * confirmarProducto - para confirmar producto se realiza la acción de sync
     * de todos los mensajes externo que viene de diversos servidores.
     * En caso de que falten mensajes no se pasa a la procima acción, quedando en espera.
     * En el caso de agenda verifica que sea por correo
     *
     * @param  {type} lifeCycle description
     * @param  {type} data      description
     * @return {type}           description
     */
    onConfirmarProducto: function (lifeCycle,data) {
      // primero verifico que no haya sido YA liberado el producto,
      // conseciencia de otro mensaje de otra servidor. Async!!!
      if (_.contains(this.history,'productoLiberado')) {
        // si ya fue liberado no hago nada ni doy error.
        // La compra ya esta en estado terminal.
        return false;
      }

      if (_.contains(this.history,'infraccionInformada')
          && _.contains(this.history,'pagoInformado')
          && _.contains(this.history,'agendaInformada')) {
            return ['entregarProducto'];
      } else {
        // no se cumple la sync, queda esperando el resto de los mensajes pendientes.
        return false;
      }
    },

    onEntregarProducto: function (lifeCycle,data) {
      // Llegamos al final, nada que hacer, sólo cambiar el estado
      return false;
    }

  }

});

// helper para publicar un mensaje en el exchange de rabbitmq
function publicar(topico,mensaje) {
  amqp.connect(amqp_url, function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'livre_market';
      ch.assertExchange(ex, 'topic', {durable: true});
      ch.publish(ex,topico, new Buffer(mensaje));
      console.log(" [x] Sent %s: '%s'", topico, mensaje);
    });
  });
};


module.exports= PublicacionesJssm;
