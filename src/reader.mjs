export async function collect(client) {
 const document=await client("/event");
 return [{id:document.recordId,...document}];
}
