import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
problem={'description':'Rejected request','content':{'application/problem+json':{'schema':{'type':'object','required':['type','title','status'],'properties':{'type':{'type':'string'},'title':{'type':'string'},'status':{'type':'integer'}}}}}}
responses={str(n):problem for n in [400,401,403,429,503]}
def op(name,description,request=None,success=200,schema=None):
 o={'operationId':name,'summary':description,'description':description,'security':[],'responses':{str(success):{'description':'Successful response','content':{'application/json':{'schema':schema or {'type':'object'}}}},**responses}}
 if request:o['requestBody']={'required':True,'content':{'application/json':{'schema':request}}}
 return o
def obj(properties,required):return {'type':'object','required':required,'properties':properties,'additionalProperties':False}
string={'type':'string'}
paths={
 '/health':{'get':op('health','Verify chain and genesis identity; readiness is not a block-liveness check')},
 '/api/v1/network':{'get':op('networkConfiguration','Return public chain, token, RPC and CAPTCHA configuration')},
 '/rpc':{'post':op('restrictedRpc','Restricted JSON-RPC 2.0. Batch size <=10, each member consumes one rate unit. No notifications, state overrides, full-block transactions, server-side signing, account unlocking, admin/debug, mining or validator voting. Calls <=1M gas, logs <=1001 explicit blocks and one contract. Signed writes fixed chain 771337, <=1M gas, zero native value, contract creation blocked.',{'oneOf':[{'$ref':'#/components/schemas/Rpc'},{'type':'array','minItems':1,'maxItems':10,'items':{'$ref':'#/components/schemas/Rpc'}}]})},
 '/api/v1/faucet/challenges':{'post':op('createFaucetChallenge','Create expiring origin/wallet/chain/token-bound signature challenge. Browser Origin required.',obj({'address':{'type':'string','pattern':'^0x[0-9a-fA-F]{40}$'}},['address']),201,obj({'id':string,'message':string,'expiresAt':{'type':'integer'}},['id','message','expiresAt']))},
 '/api/v1/faucet/claims':{'post':op('createFaucetClaim','Requires unexpired challenge, wallet signature and server-validated CAPTCHA token. Serialized single-instance signer; atomic durable claim reservation and budget.',obj({'challengeId':string,'signature':string,'turnstileToken':{'type':'string','maxLength':2048}},['challengeId','signature','turnstileToken']),201)},
 '/api/v1/faucet/claims/{id}':{'get':op('faucetClaimStatus','Return claim status and transaction hashes, not private signatures or keys')},
}
paths['/api/v1/faucet/claims/{id}']['get']['parameters']=[{'in':'path','name':'id','required':True,'schema':{'type':'string','format':'uuid'}}]
paths['/api/v1/faucet/claims/{id}']['get']['responses']['404']=problem
spec={'openapi':'3.1.0','info':{'title':'Kdawg GNC Public Beta','version':'0.1.0','description':'Permissioned EVM test network; no cash value or casino token settlement. Browser Origin allowlist, verified wallet signature plus CAPTCHA for claims. API only behind HTTPS edge; direct node RPC private.','license':{'name':'Private beta'}} ,'servers':[{'url':'https://{host}','variables':{'host':{'default':'beta.example.invalid','description':'Replace with the verified deployed endpoint'}}}],'security':[],'paths':paths,'components':{'schemas':{'Rpc':obj({'jsonrpc':{'const':'2.0'},'id':{'oneOf':[{'type':'integer'},{'type':'string','maxLength':64}]},'method':string,'params':{'type':'array'}},['jsonrpc','id','method','params'])}}}
(root/'openapi.json').write_text(json.dumps(spec,indent=2)+'\n')
