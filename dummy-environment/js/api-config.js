(function(root){
 const configured=root.UNILUS_API_BASE;
 const local=['localhost','127.0.0.1',''].includes(location.hostname);
 const value=configured || (local?'http://localhost:5000/api':'/api');
 const url=new URL(value,location.href);
 if(!local&&url.protocol!=='https:')throw Error('Production API must use HTTPS');
 root.UNILUS_API_BASE=url.href.replace(/\/$/,'');
})(window);
