var amqp = require('amqplib/callback_api');
var amqp_url = require('../properties.json').amqp.url;

// recuperamoslos datos corrspondiente a cada escenario
//var datosSimulacion = require('../mom/datosSimulacion.json').compraConInfraccion;
var datosSimulacion = require('../mom/datosSimulacion.json').compraPagoRechazado;
//var datosSimulacion = require('../mom/datosSimulacion.json').compraExitosaPorCorreo;

var _ = require("underscore");
var StateMachineHistory = require('javascript-state-machine/lib/history')

var WebJssm = require('javascript-state-machine').factory({

// ###################################################
// ################# parche custom ###################
// var WebJssm = function(stateInit) {
//   this.name = "algun estado";
//   this.state = stateInit;
//   this._fsm(); //  <-- IMPORTANT
// }

// WebJssm.prototype = {
//   myStatus: function() {
//     console.log('Mi estado es ' + this.state);
//   }
// }
// require('javascript-state-machine').factory(WebJssm, {
  // init: this.state || 'compraGenerada',
// ###################################################
  init: 'compraGenerada',
  transitions: [
    {name:'solicitarEntrega',         from:'*',                                               to:'resolviendoEntrega'},
    {name:'resolverEntrega',          from:'resolviendoEntrega',                              to:'informandoEntrega'},
    {name:'informarEntregaSeleccionada',from:'informandoEntrega',                             to:'entregaInformada'},
    // {name:'reintentarEntrega',        from:'entregaInformada',                                to:'entregaInformada'},
    // ultima transicion agregada
    {name:'seleccionarPago',          from:'*',                                               to:'resolviendoPago'},
    {name:'resolverPago',             from:'resolviendoPago',                                 to:'informandoPago'},
    {name:'informarPagoSeleccionado', from:'informandoPago',                                  to:'seleccionandoPago'},
    // otra transaccion
    // {name:'cancelarCompra',           from:['compraConInfraccion','pagoRechazado'],           to:'informandoCancelacion'},
    {name:'cancelarCompra',           from:'*',                                               to:'informandoCancelacion'},
    {name:'informarCompraCancelada',  from:'informandoCancelacion',                           to:'cancelInformada'},
    {name:'informarCompraRegistrada',  from:'*',                                              to:'compraConExito'}
  ],

  data: {
    nombreSimulador: 'WEB',
    compra: new Object(),
    stepsQ: new Array(),
    // ************ parche del step ************
    dataStepQ: new Array(),
    // *****************************************
    // ************ parche del stepSocket ************
    mjesEnviados: new Array()
    // *****************************************
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
      //console.log('onTransition history: ',this.history);
    },

    onSolicitarEntrega: function (lifeCycle,data) {
      //console.log('onDetectarPublicaciones: data --> ',data);
      this.compra = data;
      return ['resolverEntrega'];
    },

    onResolverEntrega: function (lifeCycle,data) {
      //console.log('onResolverpublicacion: data --> ',data);
      // this.compra.formaEntrega = Math.random() > 0.5 ? 'retira' : 'correo';
      // this.compra.formaEntrega = 'correo';
      this.compra.formaEntrega = datosSimulacion.formaEntrega;
      // this.compra.formaEntrega = 'retira';
      return ['informarEntregaSeleccionada'];
    },

    onInformarEntregaSeleccionada: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      // publicar('compras',JSON.stringify(msg));
      publicar('compras', msg, this.mjesEnviados);
      return false;
    },

    onReintentarEntrega: function (lifeCycle,data) {
      // Se solicitó re-informar la entrega seleccionada con lo cual se re-emite el estado
      return ['informarEntregaSeleccionada'];
    },

    // ################ ultimas agregadas ########################
    onSeleccionarPago: function (lifeCycle,data) {
      //console.log('onDetectarPublicaciones: data --> ',data);
      this.compra = data;
      return ['resolverPago'];
    },

    onResolverPago: function (lifeCycle,data) {
      //console.log('onResolverpublicacion: data --> ',data);
      this.compra.medioDePago = Math.random() > 0.5 ? 'efectivo' : 'debito';
      return ['informarPagoSeleccionado'];
    },

    onInformarPagoSeleccionado: function (lifeCycle,data) {
      var msg =  {};
      msg.data = this.compra;
      msg.tarea = lifeCycle.transition;
      // publicar('compras',JSON.stringify(msg));
      publicar('compras', msg, this.mjesEnviados);
      return false;
    },

    onCancelarCompra: function (lifeCycle,data) {
      //console.log('onResolverpublicacion: data --> ',data);
      this.compra = data;
      return ['informarCompraCancelada'];
    },

    onInformarCompraCancelada: function (lifeCycle,data) {
      // var msg =  {};
      // msg.data = this.compra;
      // msg.tarea = lifeCycle.transition;
      // publicar('compras',JSON.stringify(msg));
      this.compra.hasInfraccion = _.pick(data,'hasInfraccion').hasInfraccion;
      this.compra.pagoAutorizado = _.pick(data,'pagoAutorizado').pagoAutorizado;
      if(this.compra.hasInfraccion){
        console.log("SERV_WEB: se le notifico al usuario que la compra fue cancelada xq se detecto una INFRACCION.");
      }
      else{
        if(!this.compra.pagoAutorizado){
          console.log("SERV_WEB: se le notifico al usuario que la compra fue cancelada. PAGO RECHAZADO!");
        }
      }
      return false;
    },

    onInformarCompraRegistrada: function (lifeCycle,data) {
      console.log('xxxxxxxxxxx SERV_WEB: La compra n°'+this.compra.compraId+' fue registrada con exito xxxxxxxxxxx');
      return false;
    }

  }

});

// helper para publicar un mensaje en el exchange de rabbitmq
// function publicar(topico,mensaje) {
//   amqp.connect(amqp_url, function(err, conn) {
//     conn.createChannel(function(err, ch) {
//       var ex = 'livre_market';
//       ch.assertExchange(ex, 'topic', {durable: true});
//       ch.publish(ex,topico, new Buffer(mensaje));
//       //console.log(" [x] Sent %s: '%s'", topico, mensaje);
//       console.log("[<][WEB] ==> ["+topico+"] : envia %s", mensaje);
//     });
//   });
// };

function publicar(topico, mensaje, mjesEnviados) {
  amqp.connect(amqp_url, function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'livre_market';
      ch.assertExchange(ex, 'topic', {durable: true});
      var msgString = JSON.stringify(mensaje);
      // ch.publish(ex,topico, new Buffer(mensaje));
      ch.publish(ex,topico, new Buffer(msgString));
      console.log("[<][WEB] ==> ["+topico+"] : envia %s", mensaje);
      // *****************************************************************
      // parche para amacenar los mjes enviados
      var dataMjeEnviado = {
        tarea: null,
        datos: null,
        destino: null
      }

      dataMjeEnviado.tarea = mensaje.tarea;
      dataMjeEnviado.datos = mensaje.data;
      dataMjeEnviado.destino = topico;
      mjesEnviados.push(dataMjeEnviado);
      // *****************************************************************
    });
  });
};

// helper para determinar transición condicional de infracción
function topublicacionResuelta(data) {
  if (_.pick(data,'haspublicacion').haspublicacion) {
    return 'compraConpublicacion';
  } else {
    return 'compraSinpublicacion';
  }
};

module.exports= WebJssm;
