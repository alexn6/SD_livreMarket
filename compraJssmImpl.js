var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;

var _ = require("underscore");
var StateMachineHistory = require('javascript-state-machine/lib/history')
var ComprasJssm = require('javascript-state-machine').factory({
  init: 'productoSeleccionado',
  transitions: [
    {name:'generarNuevaCompra',       from:'productoSeleccionado',                            to:'compraGenerada'},
    {name:'solicitarEntrega',         from:['compraGenerada','detectandoInfracciones',
                                            'reservandoProducto'],                            to:'seleccionandoEntrega'},
    {name:'detectarInfracciones',     from:['compraGenerada','seleccionandoEntrega',
                                            'reservandoProducto'],                            to:'detectandoInfracciones'},
    {name:'reservarProducto',         from:['compraGenerada','seleccionandoEntrega',
                                            'detectandoInfracciones'],                        to:'reservandoProducto'},
    {name:'informarEntregaSeleccionada',from:['seleccionandoEntrega','detectandoInfracciones',
                                            'reservandoProducto','compraSinInfraccion',
                                            'compraConInfraccion', 'cancelandoCompra'],       to:'entregaSeleccionada'},
    {name:'informarInfraccion',       from:'*',                                               to: function (data) {return toTransitionInfraccion(data)}},
    {name:'calcularCosto',            from:'entregaSeleccionada',                             to:'calculandoCosto'},
    {name:'informarCostoCalculado',   from:['calculandoCosto','entregaSeleccionada',
                                            'compraConfirmada', 'cancelandoCompra', 
                                            'compraSinInfraccion'],                              to:'costoCalculado'},
    {name:'seleccionarPago',          from:['entregaSeleccionada','costoCalculado'],          to:'seleccionandoPago'},
    {name:'informarPagoSeleccionado', from:['seleccionandoPago', 'compraSinInfraccion'],                               to:'pagoSeleccionado'},
    {name:'confirmarCompra',          from:'*',                                               to:'compraConfirmada'},
    {name:'cancelarCompra',           from:['compraConInfraccion','pagoRechazado'],           to:'cancelandoCompra'},
    // {name:'informarCompraCancelada',  from:'cancelandoCompra',                                to:'compraCancelada'},
    {name:'autorizarPago',            from:'compraConfirmada',                                to:'autorizandoPago'},
    {name:'informarAutorizacionPago', from:'autorizandoPago',                                 to: function (data) {return toTransitionPago(data)}},
    // ********************************** ultima agregada **********************************
    {name:'confirmarCompraFinal',     from:['pagoAutorizado','agendandoEnvio'],                                 to: 'confirmadaCompraFinal'},
    // *************************************************************************************
    {name:'agendarEnvio',             from:'pagoAutorizado',                                  to:'agendandoEnvio'},
    {name:'finalizarCompra',          from:['pagoAutorizado','agendandoEnvio',
                                            'confirmadaCompraFinal'],                       to:'compraFinalizada'}
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

    // onBeforeTransition: function (lifeCycle,data){
    //   // se cancela la transicion
    //   if(_.contains(this.history,'compraConInfraccion')){
    //     console.log('onBeforeTransition history: ',this.history);
    //     console.log("Se cancela la transicion xq se cancelo la compra");
    //     return false;
    //   }
    // },

    onBeforeInformarPagoSeleccionado: function (lifeCycle,data){
       // se cancela la transicion
       if(_.contains(this.history,'compraConInfraccion')){
         console.log('onBeforeTransition history: ',this.history);
         console.log("Se cancela la transicion <informarPagoSeleccionado> xq se cancelo la compra");
         return false;
       }
    },

    onBeforeInformarCostoCalculado: function (lifeCycle,data){
      // se cancela la transicion
      if(_.contains(this.history,'compraConInfraccion')){
        console.log('onBeforeTransition history: ',this.history);
        console.log("Se cancela la transicion <informarCostoCalculado> xq se cancelo la compra");
        return false;
      }
    },

    onBeforeInformarEntregaSeleccionada: function (lifeCycle,data){
      // se cancela la transicion
      if(_.contains(this.history,'compraConInfraccion')){
        console.log('onBeforeTransition history: ',this.history);
        console.log("Se cancela la transicion <informarEntregaSeleccionada> xq se cancelo la compra");
        return false;
      }
    },

    // onEnterState: function (lifeCycle,data) {
    //   console.log('onEnterState transition: ',lifeCycle.transition);
    //   console.log('onEnterState from: ',lifeCycle.from);
    //   console.log('onEnterState to: ',lifeCycle.to);
    //   console.log('onEnterState data: ',data);
    //   console.log('onEnterState history: ',this.history);
    // },

    onGenerarNuevaCompra: function (lifeCycle,data) {
      this.compra.compraId = _.pick(data,'compraId').compraId;
      this.compra.producto = _.pick(data,'producto').producto;
      this.compra.cliente = _.pick(data,'cliente').cliente;
      //console.log('onGenerarNuevaCompra --> ',this.data);
      return ['solicitarEntrega','detectarInfracciones','reservarProducto'];
    },

    onSolicitarEntrega: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('web',JSON.stringify(msg));
      return false;
    },

    onDetectarInfracciones: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('infracciones',JSON.stringify(msg));
      return false;
    },

    onReservarProducto: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('publicaciones',JSON.stringify(msg));
      return false;
    },

    onInformarEntregaSeleccionada: function (lifeCycle,data) {
      this.compra.formaEntrega = _.pick(data,'formaEntrega').formaEntrega;
      if (this.compra.formaEntrega == 'correo'){
        return ['calcularCosto'];
      } else {
        return ['informarCostoCalculado'];
      }
    },

    onCalcularCosto: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('envios',JSON.stringify(msg));
      return false;
    },

    onInformarCostoCalculado: function (lifeCycle,data) {
      this.compra.costo = _.pick(data,'costo').costo;
      return ['seleccionarPago'];
    },

    onSeleccionarPago: function (lifeCycle) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      // if(!(_.contains(this.history,'compraConInfraccion'))){
        publicar('web',JSON.stringify(msg));
      // }
      return false;
    },

    onInformarPagoSeleccionado: function (lifeCycle,data) {
      this.compra.medioDePago = _.pick(data,'medioDePago').medioDePago;
      return ['confirmarCompra'];
    },

    onInformarInfraccion: function (lifeCycle,data) {
      this.compra.hasInfraccion = _.pick(data,'hasInfraccion').hasInfraccion;
      if (this.compra.hasInfraccion) {
        console.log("SERV_COMPRA: se va a cancelarCompra xq se detecta una infraccion");
        return ['cancelarCompra'];
      } else {
        if(_.contains(this.history,'pagoSeleccionado')){
          return ['confirmarCompra'];
        }
      }
      return false;
    },

    onCompraConInfraccion: function (lifeCycle,data) {
      // si el estado (dinámico) es que es compra con infraccion, cancela la compra
      this.compra.motivo = 'tuvo infracciones';
    },

    onConfirmarCompra: function (lifeCycle,data) {
      // console.log("Info pagoSeleccionado: "+_.contains(this.history,'pagoSeleccionado'));
      // console.log("Info compraSinInfraccion: "+_.contains(this.history,'compraSinInfraccion'));
      // sincronizar mensaje de respuesta de infracciones y pago seleccionado
      if (_.contains(this.history,'pagoSeleccionado') && _.contains(this.history,'compraSinInfraccion')) {
        // ya pasó por los estados de pago seleccionado e infraccion resuelta ok. prosigo con la máquina
        return ['autorizarPago'];
      } else {
        // no hay sincro, espera príxima invocación
        return false;
      }
    },

    onCancelarCompra: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('web',JSON.stringify(msg));
      return false;
    },

    onAutorizarPago: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('pagos',JSON.stringify(msg));
      return false;
    },

    // onInformarAutorizacionPago: function (lifeCycle,data) {
    //   // recupera el dato para comprobar su valor
    //   this.compra.pagoAutorizado = _.pick(data,'pagoAutorizado').pagoAutorizado;
    //   // ################ agregado nuevo #####################
    //   // en FALSE: agregar una nueva transicion <InformarPagoRechazado>
    //   if (this.compra.pagoAutorizado) {
    //     return ['confirmarCompraFinal'];
    //   } else {
    //     console.log("SERV_COMPRA: se va a cancelarCompra xq NO se autoriza el pago");
    //     return ['cancelarCompra'];
    //   }
    //   // #####################################################
    //   return false;
    // },

    onInformarAutorizacionPago: function (lifeCycle,data) {
      // recupera el dato para comprobar su valor
      this.compra.pagoAutorizado = _.pick(data,'pagoAutorizado').pagoAutorizado;
      this.compra.formaEntrega = _.pick(data,'formaEntrega').formaEntrega;
      if (this.compra.pagoAutorizado) {
        if(this.compra.formaEntrega == 'correo'){
          return ['agendarEnvio','confirmarCompraFinal'];
        }
        return ['confirmarCompraFinal'];
      } else {
        console.log("SERV_COMPRA: se va a cancelarCompra xq NO se autoriza el pago");
        return ['cancelarCompra'];
      }
      return false;
    },

    onConfirmarCompraFinal: function(lifeCycle,data){
      console.log(">>> SERV_COMPRAS: se confirma finalmente la compra n°"+this.compra.compraId+" <<<<");
      // se le notifica al usuario que la compra fue registrada con exito
      var msg =  {};
      msg.data = this.compra;
      // msg.tarea = lifeCycle.transition;
      msg.tarea = 'informarCompraRegistrada';
      publicar('web',JSON.stringify(msg));
      return ['finalizarCompra'];
    },

    onPagoRechazado: function (lifeCycle,data) {
      // el estado de pago e srechazado, se cancela l acompra
      this.compra.motivo = 'pago rechazado';
      console.log("SERV_COMPRA: se va a cancelarCompra xq el pago fue rechazado");
      return ['cancelarCompra'];
    },

    onPagoAutorizado: function (lifeCycle,data) {
      // el pago fue autorizado, se continúa con el paso normal
      return ['agendarEnvio'];
    },

    onAgendarEnvio: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      publicar('envios',JSON.stringify(msg));
      // return ['finalizarCompra'];
    },

    // ###################### hacer finalizarCompra() #######################
    onFinalizarCompra: function(lifeCycle,data) {
      console.log("************ SERV_COMPRAS: la compra N°"+this.compra.compraId+" fue realizada exitosamente!! ************");
      return false;
    }

    // ###################### AGREGADO #######################
    // onInformarCompraCancelada: function (lifeCycle,data) {
    //   var msg =  {};
    //   msg.data = this.compra;
    //   msg.tarea = lifeCycle.transition;
    //   publicar('web',JSON.stringify(msg));
    //   return false;
    // },
    // #######################################################
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

// helper para determinar transición condicional de infracción
function toTransitionInfraccion(data) {
  if (_.pick(data,'hasInfraccion').hasInfraccion) {
    return 'compraConInfraccion';
  } else {
    return 'compraSinInfraccion';
  }
};

// helper para determinar transición condicional de pago rechazado
function toTransitionPago(data) {
  if (!_.pick(data,'pagoAutorizado').pagoAutorizado) {
    return 'pagoRechazado';
  } else {
    return 'pagoAutorizado';
  }
};

module.exports= ComprasJssm;
