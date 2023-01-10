
export let gas_cost=0;
//returns gas for rapid time (within 15s)
//https://www.gasnow.org/
export const getGas = async function(){
  console.log(`Updating gas cost...`);
  return fetch("https://www.gasnow.org/api/v3/gas/price?utm_source=85734", {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => {
    try {
      return res.json()
    } catch (error) {
      console.error(`Couldn't get json from gas cost response`, res);
      throw error
    }
  })
  .then(res => {
    console.log(`Gas cost response...`, res.data);
    gas_cost = res.data.rapid //this is wei amount. to convert to Gwei divide by 1000000000
    console.log(`Gas cost updated: ${gas_cost}`);
  })
  .catch((error) => {
    console.error('Error getting gas cost', error);
  });
}
