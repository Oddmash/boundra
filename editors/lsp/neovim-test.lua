local cli = assert(vim.env.BOUNDRA_CLI_PATH, "BOUNDRA_CLI_PATH required")
local server = assert(vim.env.BOUNDRA_LSP_SERVER, "BOUNDRA_LSP_SERVER required")
local root = assert(vim.env.BOUNDRA_LSP_FIXTURE, "BOUNDRA_LSP_FIXTURE required")
local function verify()
  vim.fn.mkdir(root, "p")
  root = vim.fn.resolve(root)
  local function native(args)
    vim.fn.system(vim.list_extend({ cli }, args))
    assert(vim.v.shell_error == 0, "Native fixture setup failed")
  end
  native({ "init", "--root", root, "--name", "lsp-neovim" })
  native({ "create-domain", "order", "--root", root })
  local file = root .. "/domains/order/client/a.ts"
  vim.fn.writefile({ "import '../server/public';" }, file)
  vim.cmd("edit " .. vim.fn.fnameescape(file))
  local bufnr = vim.api.nvim_get_current_buf()
  local client = assert(vim.lsp.start_client({ name = "boundra-preview", cmd = { "node", server, "--root", root, "--cli", cli }, root_dir = root }))
  local started = vim.loop.hrtime()
  assert(vim.lsp.buf_attach_client(bufnr, client))
  assert(vim.wait(10000, function()
    for _, diagnostic in ipairs(vim.diagnostic.get(bufnr)) do
      if diagnostic.code == "BR-001" and diagnostic.lnum == 0 then return true end
    end
    return false
  end, 20), "Neovim did not receive the boundary diagnostic")
  print(string.format("Neovim initial diagnostic: %.0f ms", (vim.loop.hrtime() - started) / 1000000))
  vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, { "export {};" })
  local saved = vim.loop.hrtime()
  vim.cmd("write")
  assert(vim.wait(10000, function() return #vim.diagnostic.get(bufnr) == 0 end, 20), "Neovim did not clear the saved correction")
  print(string.format("Neovim save-to-clear: %.0f ms", (vim.loop.hrtime() - saved) / 1000000))
  vim.lsp.stop_client(client)
end
local ok, reason = pcall(verify)
if not ok then vim.api.nvim_err_writeln(tostring(reason)); vim.cmd("cquit") else vim.cmd("qa!") end
