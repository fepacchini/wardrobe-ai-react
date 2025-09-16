# Guarda‑Roupa Virtual • React (Vite + Tailwind)

Um aplicativo React moderno para gerenciamento de guarda-roupa virtual com inteligência artificial. O app permite cadastrar peças de roupa por foto, sugere automaticamente **categoria/estilo/tecido**, extrai **cor dominante** e recomenda **looks** considerando **temperatura, local e tecido**.

## ✨ Funcionalidades

- 📸 **Cadastro por foto**: Tire fotos das suas roupas ou selecione da galeria
- 🤖 **IA integrada**: Sugestões automáticas usando MobileNet para classificação de imagens
- 🎨 **Extração de cores**: Algoritmo de histograma de matiz para detectar cores dominantes
- 👔 **Recomendação de looks**: Sistema inteligente que considera:
  - Harmonia de cores
  - Adequação ao estilo e ocasião
  - Temperatura percebida e tipo de ambiente
  - Propriedades dos tecidos
- 📱 **Interface responsiva**: Design moderno com Tailwind CSS
- 💾 **Armazenamento local**: Dados salvos no localStorage do navegador

## 🚀 Tecnologias

- **React 18** com hooks modernos
- **Vite** para build rápido e desenvolvimento
- **Tailwind CSS** para estilização
- **TensorFlow.js** com MobileNet para classificação de imagens
- **Canvas API** para processamento de imagens
- **LocalStorage** para persistência de dados

## 🏃‍♂️ Rodando localmente

```bash
# Clone o repositório
git clone https://github.com/fepacchini/wardrobe-ai-react.git
cd wardrobe-ai-react

# Instale as dependências
npm install

# Execute o servidor de desenvolvimento
npm run dev
```

Abra a URL indicada (ex.: http://localhost:5173) no seu navegador.

## 📦 Build para produção

```bash
npm run build
```

Os arquivos otimizados serão gerados na pasta `dist/`.

## 🧠 Como funciona a IA

### Classificação de Imagens
O app utiliza o modelo **MobileNet** do TensorFlow.js com fallbacks para diferentes CDNs:
1. `https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/+esm`
2. `https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.esm.min.js`
3. `https://esm.sh/@tensorflow-models/mobilenet@2.1.0`

### Extração de Cores
- Redimensiona a imagem para 120x80px para otimização
- Divide o espectro de cores em 36 bins de matiz
- Calcula histograma ponderado por saturação e luminosidade
- Retorna as 2 cores mais dominantes

### Sistema de Recomendação
O algoritmo de recomendação considera múltiplos fatores:

**Harmonia de cores**: Cores complementares e análogas recebem pontuação maior
**Adequação ao estilo**: Matching entre ocasião e estilo das peças
**Conforto térmico**: Ajuste da temperatura baseado no tipo de ambiente:
- Ambiente interno com AC: máximo 24°C
- Externo sob sol: +3°C na temperatura
- Tecidos adequados para cada faixa de temperatura

## 📁 Estrutura do Projeto

```
src/
├── components/
│   └── ui/           # Componentes de interface reutilizáveis
├── lib/
│   ├── ai.js         # Lógica de IA e heurísticas
│   ├── colors.js     # Processamento de cores
│   ├── domain.js     # Constantes e validações de domínio
│   ├── recommendation.js  # Algoritmo de recomendação
│   └── utils.js      # Utilitários gerais
├── App.jsx           # Componente principal
├── main.jsx          # Ponto de entrada
└── index.css         # Estilos globais
```

## 🎯 Próximas funcionalidades

- [ ] Exportação/importação de dados
- [ ] Categorias personalizadas
- [ ] Histórico de looks usados
- [ ] Integração com APIs de clima
- [ ] Modo escuro
- [ ] PWA (Progressive Web App)

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🙏 Agradecimentos

- [TensorFlow.js](https://www.tensorflow.org/js) pela biblioteca de ML
- [Tailwind CSS](https://tailwindcss.com/) pelo framework de CSS
- [Vite](https://vitejs.dev/) pela ferramenta de build
- Comunidade React pela inspiração e recursos

---

**Desenvolvido com ❤️ usando React + IA**
