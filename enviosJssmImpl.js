var amqp = require('amqplib/callback_api');
var amqp_url = require('./properties.json').amqp.url;
var _ = require("underscore");
var StateMachineHistory = require('javascript-state-machine/lib/history')

var EnviosJssm = require('javascript-state-machine').factory({
  init: 'entregaSeleccionada',
  transitions: [
    {name:'calcularCosto',            from:'entregaSeleccionada',                             to:'resolviendoCosto'},
    {name:'resolverCosto',            from:'resolviendoCosto',                                to:'informandoCosto'},
    {name:'informarCostoCalculado',   from:'informandoCosto',                                 to:'costoInformado'},
    // el * indica q en cualqie momento se puede agendar un envio
    {name:'agendarEnvio',             from:'*',                                 to:'agendandoEnvio'},
    {name:'informarEnvioAgendado',    from:'agendandoEnvio',                                 to:'envioAgendado'}
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

    onCalcularCosto: function (lifeCycle,data) {
        //console.log('onDetectarInfracciones: data --> ',data);
        this.compra = data;
        return ['resolverCosto'];
      },
  
    onResolverCosto: function (lifeCycle,data) {
        //console.log('onResolverInfraccion: data --> ',data);
        this.compra.costo = '200pe';
        return ['informarCostoCalculado'];
    },
  
    onInformarCostoCalculado: function (lifeCycle,data) {
        var msg =  {};
        msg.data = this.compra;
        msg.tarea = lifeCycle.transition;
        // tmb se deberia publicar el mensaje en el de publicaciones
        publicar('compras',JSON.stringify(msg));
        return false;
    },

    onAgendarEnvio: function (lifeCycle,data) {
      this.compra.envioAgendado = true;
      return ['informarEnvioAgendado'];
    },

    onInformarEnvioAgendado: function (lifeCycle,data) {
      console.log('[Compra n°'+this.compra.compraId+'] ========> ENVIO AGENDADO');
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

// helper para determinar transición condicional de infracción
// function toInfraccionResuelta(data) {
//   if (_.pick(data,'hasInfraccion').hasInfraccion) {
//     return 'compraConInfraccion';
//   } else {
//     return 'compraSinInfraccion';
//   }
// };

module.exports= EnviosJssm;
