package com.bloom.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import com.bloom.auth.LocalWorkspaceContext;
import com.bloom.user.DemoWorkspaceSeeder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** MockMvc helpers: JSON in/out and the local workspace header. */
public abstract class ApiTest extends IntegrationTest {
    protected static final UUID DEMO = DemoWorkspaceSeeder.DEMO_WORKSPACE_ID;
    protected static final UUID PERSONAL = DemoWorkspaceSeeder.PERSONAL_WORKSPACE_ID;

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected ObjectMapper json;

    protected Response call(HttpMethod method, String path, Object body) throws Exception {
        return call(DEMO, method, path, body);
    }

    protected Response call(UUID workspace, HttpMethod method, String path, Object body) throws Exception {
        MockHttpServletRequestBuilder req = request(method, path).header(LocalWorkspaceContext.HEADER, workspace.toString());
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        MvcResult r = mvc.perform(req).andReturn();
        String text = r.getResponse().getContentAsString();
        return new Response(r.getResponse().getStatus(), text.isEmpty() ? null : json.readTree(text), text);
    }

    public record Response(int status, JsonNode body, String raw) {
        public String code() {
            return body == null || body.get("code") == null ? null : body.get("code").asText();
        }
    }
}
