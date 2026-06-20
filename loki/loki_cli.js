const readline = require('readline');
const { runLoki } = require('./loki_core');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask() {
  rl.question('You: ', async (input) => {
    const result = await runLoki(input);
    console.log(`Loki: ${result.reply}`);
    console.log('Why:', JSON.stringify(result.reasoning, null, 2));
    ask();
  });
}

ask();