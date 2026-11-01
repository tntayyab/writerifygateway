const D="https://ep-sparkling-violet-b5wgue4f.c-7.us-east-2.aws.neon.tech/sql",H=atob("cG9zdGdyZXNxbDovL25lb25kYl9vd25lcjpucGdfUHlMdHBjbEFFNEk2QGVwLXNwYXJrbGluZy12aW9sZXQtYjV3Z3VlNGYuYy03LnVzLWVhc3QtMi5hd3MubmVvbi50ZWNoL25lb25kYj9zc2xtb2RlPXJlcXVpcmU=");async function o(t){const a=await fetch(D,{method:"POST",headers:{"Neon-Connection-String":H},body:JSON.stringify({query:t})});if(!a.ok){const i=await a.text();throw new Error(`Neon SQL error (${a.status}): ${i}`)}return(await a.json()).rows||[]}function M(t="lifetime"){switch(t){case"today":return"WHERE timestamp >= DATE_TRUNC('day', NOW())";case"yesterday":return"WHERE timestamp >= DATE_TRUNC('day', NOW() - INTERVAL '1 day') AND timestamp < DATE_TRUNC('day', NOW())";case"this_week":return"WHERE timestamp >= DATE_TRUNC('week', NOW())";case"last_week":return"WHERE timestamp >= DATE_TRUNC('week', NOW() - INTERVAL '1 week') AND timestamp < DATE_TRUNC('week', NOW())";case"this_month":return"WHERE timestamp >= DATE_TRUNC('month', NOW())";case"last_month":return"WHERE timestamp >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND timestamp < DATE_TRUNC('month', NOW())";case"lifetime":default:return""}}async function I(t="lifetime"){const s=`
    SELECT 
      m.id, m.email, m.name, m.role, m.status, m.approved_by, m.notes,
      m.mobile, COALESCE(m.plan, 'free_trial') as plan,
      COALESCE(m.agreed_price, 0) as agreed_price,
      COALESCE(m.paid_amount, 0) as paid_amount,
      m.anydesk_id,
      COALESCE(m.is_earning, false) as is_earning,
      COALESCE(m.is_supported, false) as is_supported,
      COALESCE(m.is_email_verified, false) as is_email_verified,
      m.created_at, m.updated_at,
      COALESCE(stats.contents_count, 0)::int as contents_count,
      COALESCE(stats.req_count, 0)::int as requests_count,
      COALESCE(stats.total_tokens, 0)::bigint as tokens_count,
      COALESCE(prov.providers_json, '[]'::json) as connected_providers,
      stats.last_active
    FROM public.kyros_access_control m
    LEFT JOIN public."user" u ON LOWER(u.email) = LOWER(m.email)
    LEFT JOIN public.tenants t ON t.owner_user_id = u.id
    LEFT JOIN (
      SELECT 
        tenant_id,
        COUNT(*) as req_count,
        COUNT(CASE WHEN status = 'success' AND (output_tokens >= 500 OR input_tokens >= 1000) THEN 1 END) as contents_count,
        SUM(input_tokens + output_tokens) as total_tokens,
        MAX(timestamp) as last_active
      FROM public.agent_messages
      ${M(t)}
      GROUP BY tenant_id
    ) stats ON stats.tenant_id = t.id
    LEFT JOIN (
      SELECT 
        tp.tenant_id,
        json_agg(DISTINCT COALESCE(cp.name, tp.provider)) FILTER (WHERE COALESCE(cp.name, tp.provider) IS NOT NULL AND COALESCE(cp.name, tp.provider) <> '') as providers_json
      FROM public.tenant_providers tp
      LEFT JOIN public.custom_providers cp ON tp.custom_provider_id = cp.id
      WHERE tp.is_active = true
      GROUP BY tp.tenant_id
    ) prov ON prov.tenant_id = t.id
    ORDER BY 
      CASE 
        WHEN m.status = 'pending' THEN 1
        WHEN m.status = 'approved' THEN 2
        ELSE 3
      END,
      requests_count DESC,
      m.updated_at DESC;
  `;return o(s)}async function U(t,a){const s=t.replace(/'/g,"''"),l=`
    UPDATE public.kyros_access_control
    SET plan = '${a.replace(/'/g,"''")}', updated_at = NOW()
    WHERE LOWER(email) = LOWER('${s}');
  `;return o(l)}async function h(t,a,s){const i=t.replace(/'/g,"''"),l=`
    UPDATE public.kyros_access_control
    SET agreed_price = ${Number(a)||0}, paid_amount = ${Number(s)||0}, updated_at = NOW()
    WHERE LOWER(email) = LOWER('${i}');
  `;return o(l)}async function $(t,a,s,i){const l=t.replace(/'/g,"''"),m=`
    UPDATE public.kyros_access_control
    SET anydesk_id = '${a.replace(/'/g,"''")}', is_earning = ${s?"true":"false"}, is_supported = ${i?"true":"false"}, updated_at = NOW()
    WHERE LOWER(email) = LOWER('${l}');
  `;return o(m)}async function P(t,a,s,i){const l=t.trim().toLowerCase().replace(/'/g,"''"),d=a.trim().replace(/'/g,"''"),m=s.trim().replace(/'/g,"''"),E=i.trim().replace(/'/g,"''"),p=`
    INSERT INTO public.kyros_access_control (email, name, role, status, plan, approved_by, notes, created_at, updated_at)
    VALUES ('${l}', '${d}', '${m}', 'approved', '${E}', 'itstasdidnur@gmail.com', 'Pre-approved by Boss TN TAYYAB', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE
    SET role = EXCLUDED.role, status = 'approved', plan = EXCLUDED.plan, updated_at = NOW();
  `;return o(p)}async function Y(t,a="Boss TN TAYYAB"){const s=t.trim().toLowerCase().replace(/'/g,"''"),i=a.replace(/'/g,"''");return await o(`DELETE FROM public.session WHERE "userId" IN (SELECT id FROM public.user WHERE LOWER(email) = LOWER('${s}'));`),o(`
    UPDATE public.kyros_access_control
    SET status = 'rejected', approved_by = '${i}', notes = 'Blocked by Admin', updated_at = NOW()
    WHERE LOWER(email) = LOWER('${s}');
  `)}async function B(t){const a=t.trim().toLowerCase().replace(/'/g,"''");return o(`
    UPDATE public.kyros_access_control
    SET status = 'pending', notes = 'Unblocked by Admin - Pending Review', updated_at = NOW()
    WHERE LOWER(email) = LOWER('${a}');
  `)}async function j(t){const a=t.trim().toLowerCase().replace(/'/g,"''");return await o(`DELETE FROM public.session WHERE "userId" IN (SELECT id FROM public.user WHERE LOWER(email) = LOWER('${a}'));`),await o(`DELETE FROM public.account WHERE "userId" IN (SELECT id FROM public.user WHERE LOWER(email) = LOWER('${a}'));`),await o(`DELETE FROM public.user WHERE LOWER(email) = LOWER('${a}');`),await o(`DELETE FROM public.kyros_email_verifications WHERE LOWER(email) = LOWER('${a}');`),o(`DELETE FROM public.kyros_access_control WHERE LOWER(email) = LOWER('${a}');`)}function N(t){if(!t)return"None";let a=t.replace(/^custom:[^/]+\//,"");if(a.includes("/")){const s=a.split("/");return s[s.length-1]}return a}function O(t){if(!t)return"Unknown";if(t.startsWith("custom:"))return"Custom Gateway";const a=t.toLowerCase();return a==="openrouter"?"OpenRouter":a==="openai"?"OpenAI":a==="anthropic"?"Anthropic":a==="google"?"Google Gemini":a==="groq"?"Groq":a==="ollama"?"Ollama (Local)":t.charAt(0).toUpperCase()+t.slice(1)}function A(t,a){if(!t)return!1;const s=t.toLowerCase(),i=(a||"").toLowerCase();return!!(s.includes("free")||i.includes("free")||s==="openrouter/free")}async function J(){const t=`
    WITH user_base AS (
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.image as user_image,
        u."createdAt" as user_created_at,
        COALESCE(p.display_name, u.name) as display_name,
        p.headline,
        p.bio,
        p.location,
        p.website,
        p.banner_url,
        p.avatar_url,
        m.mobile,
        m.anydesk_id,
        COALESCE(m.is_earning, false) as is_earning,
        COALESCE(m.is_supported, false) as is_supported,
        COALESCE(m.plan, 'owner') as plan,
        COALESCE(m.role, 'superadmin') as member_role
      FROM "user" u
      LEFT JOIN kyros_user_profiles p ON LOWER(p.email) = LOWER(u.email)
      LEFT JOIN kyros_access_control m ON LOWER(m.email) = LOWER(u.email)
    ),
    agent_tiers AS (
      SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.display_name as agent_display_name,
        a.agent_category,
        a.agent_platform,
        t.owner_user_id as user_id,
        json_agg(json_build_object(
          'tier', ta.tier,
          'primary_route', ta.override_route,
          'fallback_routes', ta.fallback_routes
        )) as tiers
      FROM agents a
      JOIN tenants t ON t.id = a.tenant_id
      LEFT JOIN tier_assignments ta ON ta.agent_id = a.id
      WHERE a.deleted_at IS NULL
      GROUP BY a.id, a.name, a.display_name, a.agent_category, a.agent_platform, t.owner_user_id
    ),
    agent_metrics AS (
      SELECT 
        agent_name,
        count(*) as total_messages,
        COALESCE(sum(input_tokens + output_tokens), 0) as total_tokens,
        COALESCE(sum(cost_usd), 0) as total_cost,
        max(timestamp) as last_active,
        (SELECT model FROM agent_messages m2 WHERE m2.agent_name = m.agent_name ORDER BY timestamp DESC LIMIT 1) as last_model,
        (SELECT provider FROM agent_messages m3 WHERE m3.agent_name = m.agent_name ORDER BY timestamp DESC LIMIT 1) as last_provider
      FROM agent_messages m
      GROUP BY agent_name
    ),
    combined_agents AS (
      SELECT 
        at.*,
        COALESCE(am.total_messages, 0) as total_messages,
        COALESCE(am.total_tokens, 0) as total_tokens,
        COALESCE(am.total_cost, 0) as total_cost,
        am.last_active,
        am.last_model,
        am.last_provider
      FROM agent_tiers at
      LEFT JOIN agent_metrics am ON am.agent_name = at.agent_name
    ),
    grouped_user_agents AS (
      SELECT 
        user_id,
        json_agg(row_to_json(combined_agents)) as harnesses,
        COALESCE(sum(total_messages), 0) as total_messages,
        COALESCE(sum(total_tokens), 0) as total_tokens,
        COALESCE(sum(total_cost), 0) as total_cost,
        max(last_active) as last_active
      FROM combined_agents
      GROUP BY user_id
    )
    SELECT 
      ub.*,
      COALESCE(gua.harnesses, '[]'::json) as harnesses,
      COALESCE(gua.total_messages, 0) as total_messages,
      COALESCE(gua.total_tokens, 0) as total_tokens,
      COALESCE(gua.total_cost, 0) as total_cost,
      gua.last_active
    FROM user_base ub
    LEFT JOIN grouped_user_agents gua ON gua.user_id = ub.user_id;
  `,a=`
    SELECT 
      id,
      provider,
      label,
      key_prefix,
      auth_type,
      is_active,
      connected_at,
      CASE 
        WHEN provider = 'openrouter' OR provider LIKE '%free%' THEN true 
        ELSE false 
      END as is_free
    FROM tenant_providers;
  `,[s,i]=await Promise.all([o(t),o(a)]),l=i.map(e=>({id:e.id,provider:e.provider,clean_provider:O(e.provider),label:e.label||"Default",key_prefix:e.key_prefix,auth_type:e.auth_type,is_active:!!e.is_active,is_free:!!e.is_free,connected_at:e.connected_at}));let d=0,m=0,E=0,p=0;const R=[],y=s.map(e=>{m+=Number(e.total_tokens)||0,E+=Number(e.total_cost)||0;const b=typeof e.harnesses=="string"?JSON.parse(e.harnesses):e.harnesses||[];p+=b.length;const u=b.map(r=>{const g=(typeof r.tiers=="string"?JSON.parse(r.tiers):r.tiers||[]).map(_=>{const f=_.primary_route,L=f?.model||null,C=f?.provider||null,k=(_.fallback_routes||[]).map((c,w)=>(d++,{model:c.model,clean_model:N(c.model),provider:c.provider,clean_provider:O(c.provider),is_free:A(c.model,c.provider),rank:w+1}));return{tier:_.tier||"default",primary_model:L,clean_primary_model:N(L),primary_provider:C,clean_primary_provider:O(C),is_primary_free:A(L,C),fallbacks:k}}),W=g.find(_=>_.tier==="default"&&_.primary_model)||g.find(_=>_.primary_model)||g[0]||null,n={agent_id:r.agent_id,agent_name:r.agent_name,agent_display_name:r.agent_display_name||r.agent_name,agent_category:r.agent_category,agent_platform:r.agent_platform,tiers:g,primary_tier:W,total_messages:Number(r.total_messages)||0,total_tokens:Number(r.total_tokens)||0,total_cost:Number(r.total_cost)||0,last_model:r.last_model,clean_last_model:N(r.last_model),last_provider:r.last_provider,clean_last_provider:O(r.last_provider),last_active:r.last_active};return R.push({agent_id:n.agent_id,agent_name:n.agent_name,display_name:n.agent_display_name,agent_category:n.agent_category,agent_platform:n.agent_platform,user_email:e.user_email,user_name:e.user_name,connected_providers:l,tiers:n.tiers,primary_tier:n.primary_tier,total_messages:n.total_messages,total_tokens:n.total_tokens,total_cost:n.total_cost,last_model:n.last_model,clean_last_model:n.clean_last_model,last_provider:n.last_provider,last_active:n.last_active}),n}),S=u.slice().sort((r,T)=>T.total_messages-r.total_messages)[0]||u.find(r=>r.primary_tier?.primary_model)||u[0]||null;return{user_id:e.user_id,user_name:e.user_name||"TN TAYYAB",user_email:e.user_email||"itstasdidnur@gmail.com",user_image:e.user_image,user_created_at:e.user_created_at,display_name:e.display_name||e.user_name||"TN TAYYAB",headline:e.headline,bio:e.bio,location:e.location,website:e.website,banner_url:e.banner_url,avatar_url:e.avatar_url,mobile:e.mobile,anydesk_id:e.anydesk_id,is_earning:!!e.is_earning,is_supported:!!e.is_supported,plan:e.plan||"owner",member_role:e.member_role||"superadmin",harnesses:u,primary_harness:S,connected_providers:l,total_messages:Number(e.total_messages)||0,total_tokens:Number(e.total_tokens)||0,total_cost:Number(e.total_cost)||0,last_active:e.last_active}}),v={total_users:y.length,total_agents:p,total_providers:l.length,free_providers_count:l.filter(e=>e.is_free).length,paid_providers_count:l.filter(e=>!e.is_free).length,total_fallback_models:d,total_tokens_consumed:m,total_cost_usd:E};return{users:y,agents:R,providers:l,summary:v}}export{U as a,Y as b,h as c,j as d,J as e,$ as f,I as g,o as h,B as u,P as w};
