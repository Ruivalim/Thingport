/** Starter category tree modeled on MakerWorld's, with matching Thingiverse, Printables, MyMiniFactory and Snapmaker
 * ids so imports are auto-categorized from the start. */
export type DefaultCategoryNode = {
  name: string;
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  makerworldCatIds?: number[];
  thingiverseCatIds?: number[];
  printablesCatIds?: number[];
  myminifactoryCatIds?: number[];
  snapmakerCatIds?: number[];
  children?: DefaultCategoryNode[];
};

export const DEFAULT_CATEGORIES: DefaultCategoryNode[] = [
  {
    name: "3D Printer",
    metaTitle: "3D Printer",
    metaDescription:
      "Whether you're looking to enhance your 3D printing experience with accessories or need to replace a printer part with a printed one, we have you covered. You can download and print models from a wide selection available just a click away.",
    makerworldCatIds: [900],
    thingiverseCatIds: [73],
    printablesCatIds: [1],
    myminifactoryCatIds: [366],
    snapmakerCatIds: [103],
    children: [
      {
        name: "3D Printer Accessories",
        metaTitle: "3D Printer Accessories",
        metaDescription:
          "Elevate your 3D printing experience with our curated selection of premium accessories. Discover a wide range of essential tools and components designed to optimize print quality, enhance performance, and expand the capabilities of your 3D printer.",
        makerworldCatIds: [901],
        thingiverseCatIds: [127],
        printablesCatIds: [40],
        myminifactoryCatIds: [1001, 1000],
        snapmakerCatIds: [116, 115, 117, 118],
      },
      {
        name: "3D Printer Parts",
        metaTitle: "3D Printer Parts & Upgrades",
        metaDescription:
          "Transform your 3D printer into a powerhouse of precision and performance with our extensive range of high-quality 3D printer parts and upgrades. Whether you're seeking to enhance print accuracy, increase printing speed, or expand your printer's functionality, our carefully curated selection of replacement parts and innovative upgrades caters to every need.",
        makerworldCatIds: [902],
        thingiverseCatIds: [128, 152, 126],
        printablesCatIds: [134, 138, 136, 135, 2, 137],
        myminifactoryCatIds: [
          493, 494, 495, 588, 590, 591, 592, 593, 594, 595, 596, 597, 598, 599, 600, 601, 602, 603, 604, 605, 606, 607,
          608, 672, 949, 1271,
        ],
      },
      {
        name: "Test Models",
        metaTitle: "3D Printer Test Models",
        metaDescription:
          "Ensure flawless prints and optimal performance with our collection of essential 3D printer test models. These meticulously designed models provide a comprehensive platform for evaluating printer settings, diagnosing potential issues, and validating print quality.",
        makerworldCatIds: [903],
        thingiverseCatIds: [129],
        printablesCatIds: [12],
        myminifactoryCatIds: [960],
        snapmakerCatIds: [114],
      },
    ],
  },
  {
    name: "Art",
    metaTitle: "3D Printed Art Models",
    metaDescription:
      'Explore the "Art" category of 3D printing models and discover a wide range of stunning designs that can be printed and displayed in any environment. From 2D art to sculptures, download premium model files and add a touch of beauty and creativity to your space with these unique designs.',
    makerworldCatIds: [100],
    thingiverseCatIds: [63],
    printablesCatIds: [13],
    snapmakerCatIds: [104],
    children: [
      {
        name: "2D Art",
        metaTitle: "2D Art Models",
        metaDescription:
          "Bring your favorite paintings, drawings, and illustrations to life with our innovative collection of 3D printed 2D art models. Experience the beauty of art in a new dimension as we transform cherished 2D artworks into stunning 3D printed creations.",
        makerworldCatIds: [101],
        thingiverseCatIds: [144],
        printablesCatIds: [16],
        snapmakerCatIds: [119],
      },
      {
        name: "Coin & Badges",
        metaTitle: "3D Printed Coin & Badges",
        metaDescription:
          "Create unique and memorable keepsakes with our collection of customizable 3D printed coins and badges. Commemorate special events, recognize achievements, or simply express your individuality with personalized designs that are sure to impress.",
        makerworldCatIds: [103],
        thingiverseCatIds: [143],
      },
      {
        name: "Signs & Logos",
        metaTitle: "3D Printed Signs & Logos",
        metaDescription:
          "Elevate your branding and signage with our collection of impactful 3D printed signs and logos. Create custom signage for businesses, events, or home décor that stands out from the crowd.",
        makerworldCatIds: [102],
        thingiverseCatIds: [76],
        myminifactoryCatIds: [105],
      },
      {
        name: "Sculptures",
        metaTitle: "3D Printed Sculptures",
        metaDescription:
          "Explore a world of captivating 3D printed sculptures that showcase the artistry and innovation of this transformative technology. From lifelike figures and abstract forms to intricate details and mesmerizing textures, our curated collection of 3D printed sculptures offers a diverse range of artistic expressions that will inspire and amaze.",
        makerworldCatIds: [104],
        thingiverseCatIds: [80],
        printablesCatIds: [14],
        myminifactoryCatIds: [112, 355],
        snapmakerCatIds: [121],
      },
      {
        name: "Other Art Models",
        metaTitle: "Other Art Models",
        metaDescription:
          "Transform your home décor with unique 3D printed art models. Discover vases, lamps, boxes, sculptures, and more!",
        makerworldCatIds: [105],
        thingiverseCatIds: [75, 78, 79, 145],
        printablesCatIds: [15, 41],
        snapmakerCatIds: [120, 183],
      },
    ],
  },
  {
    name: "Education",
    metaTitle: "3D Printed Educational Models",
    metaDescription:
      "Explore 3D printing designs to enhance learning and create interactive educational tools. Discover a wide range of 3D printable models covering subjects such as science, geography, history, mathematics, and more. Ideal for educators and learners of all ages.",
    makerworldCatIds: [500],
    thingiverseCatIds: [69],
    printablesCatIds: [90],
    myminifactoryCatIds: [86],
    snapmakerCatIds: [106],
    children: [
      {
        name: "Biology",
        metaTitle: "3D Printed Biology Models",
        metaDescription:
          "Explore the intricate world of life with our meticulously crafted 3D printed biology models, visualizing and understanding anatomy, molecular structures, and biological processes.",
        makerworldCatIds: [503],
        thingiverseCatIds: [106],
        myminifactoryCatIds: [154, 373, 997, 1045],
        snapmakerCatIds: [129],
      },
      {
        name: "Chemistry",
        metaTitle: "3D Printed Chemistry Models",
        metaDescription:
          "Unravel the mysteries of matter with our captivating 3D printed chemistry models, visualizing and understanding molecular structures, chemical compounds, and complex reactions.",
        makerworldCatIds: [505],
        printablesCatIds: [92],
        myminifactoryCatIds: [162],
        snapmakerCatIds: [128],
      },
      {
        name: "Engineering",
        metaTitle: "3D Printed Engineering Models",
        metaDescription:
          "Transform abstract engineering concepts into tangible realities with our innovative 3D printed models, exploring mechanical components, architectural structures, and electronic circuits.",
        makerworldCatIds: [501],
        thingiverseCatIds: [104],
        printablesCatIds: [93],
        myminifactoryCatIds: [953, 241, 374, 1042],
        snapmakerCatIds: [132],
      },
      {
        name: "Geography",
        metaTitle: "3D Printed Geography Models",
        metaDescription:
          "Embark on a geographical journey around the world with our captivating 3D printed models, visualizing mountain ranges, continents, oceans, rivers, and climate patterns.",
        makerworldCatIds: [506],
        printablesCatIds: [98],
        myminifactoryCatIds: [164],
        snapmakerCatIds: [130],
      },
      {
        name: "Mathematics",
        metaTitle: "3D Printed Mathematics Models",
        metaDescription:
          "Transform abstract mathematical concepts into tangible representations with our engaging 3D printed models, visualizing geometric shapes, mathematical functions, and complex mathematical concepts.",
        makerworldCatIds: [502],
        thingiverseCatIds: [105],
        printablesCatIds: [94],
        myminifactoryCatIds: [163, 1035],
        snapmakerCatIds: [126],
      },
      {
        name: "Physics & Astronomy",
        metaTitle: "3D Printed Physics & Astronomy Models",
        metaDescription:
          "Unravel the mysteries of the universe with our captivating 3D printed physics and astronomy models, visualizing physical forces, astronomical phenomena, and complex scientific theories.",
        makerworldCatIds: [504],
        thingiverseCatIds: [148],
        printablesCatIds: [91],
        myminifactoryCatIds: [165, 558, 1036],
        snapmakerCatIds: [131, 127],
      },
      {
        name: "Other Education Models",
        metaTitle: "Other Education Models",
        metaDescription:
          "Discover a world of endless learning possibilities with our diverse collection of 3D printed educational models, exploring history, social studies, art, design, language, and literature.",
        makerworldCatIds: [507],
        printablesCatIds: [96],
        myminifactoryCatIds: [344, 166, 109, 1034, 969, 970, 971, 972, 973],
        snapmakerCatIds: [133],
      },
    ],
  },
  {
    name: "Fashion",
    metaTitle: "3D Printed Fashion Models",
    metaDescription:
      'Discover contemporary and stylish 3D printable fashion accessories in the "Fashion" category. Create your own unique 3D printed items, from jewelry to purses, wallets, and belts, and express your personal fashion sense with these premium model files.',
    makerworldCatIds: [200],
    thingiverseCatIds: [64],
    printablesCatIds: [17],
    myminifactoryCatIds: [58],
    snapmakerCatIds: [107],
    children: [
      {
        name: "Bags",
        metaTitle: "3D Printed Bags",
        metaDescription:
          "Embrace a unique blend of functionality and fashion-forward design with our durable and eco-friendly 3D printed bags, ranging from trendy handbags to practical backpacks.",
        makerworldCatIds: [201],
        myminifactoryCatIds: [143],
        snapmakerCatIds: [135],
      },
      {
        name: "Clothes",
        metaTitle: "3D Printed Clothes Accessories",
        metaDescription:
          "Elevate your style with our eye-catching and personalized 3D printed clothes accessories, from statement-making necklaces and bracelets to bold earrings and scarves.",
        makerworldCatIds: [202],
        thingiverseCatIds: [142],
        myminifactoryCatIds: [169],
        snapmakerCatIds: [182],
      },
      {
        name: "Earrings",
        metaTitle: "3D Printed Earrings",
        metaDescription:
          "Make a statement with our collection of exquisite and unique 3D printed earrings, featuring a wide variety of designs from delicate and feminine to bold and geometric.",
        makerworldCatIds: [206],
        thingiverseCatIds: [139],
        myminifactoryCatIds: [405],
      },
      {
        name: "Footwear",
        metaTitle: "3D Printed Footwear",
        metaDescription:
          "Experience the ultimate in comfort and style with our innovative and customizable 3D printed footwear, designed to provide exceptional support and make a fashion statement.",
        makerworldCatIds: [204],
        myminifactoryCatIds: [140],
        snapmakerCatIds: [137],
      },
      {
        name: "Glasses",
        metaTitle: "3D Printed Glasses",
        metaDescription:
          "See the world in a new light with our stylish and functional 3D printed glasses, offering a variety of frames and lenses to create both fashionable and practical eyewear.",
        makerworldCatIds: [203],
        thingiverseCatIds: [83],
        myminifactoryCatIds: [147],
      },
      {
        name: "Jewelry",
        metaTitle: "3D Printed Jewelry",
        metaDescription:
          "Make one-of-a-kind pieces of jewelry with our amazing 3D printed jewelry, featuring a wide range of designs from delicate and intricate to bold and statement-making.",
        makerworldCatIds: [208],
        thingiverseCatIds: [84, 82],
        myminifactoryCatIds: [291, 148, 426, 359, 430, 145, 439],
        snapmakerCatIds: [134],
      },
      {
        name: "Rings",
        metaTitle: "3D Printed Rings",
        metaDescription:
          "Find the perfect ring to symbolize your love or commitment with our unique and personalized 3D printed rings, including classic wedding bands, modern statement rings, and personalized rings with custom engravings.",
        makerworldCatIds: [205],
        thingiverseCatIds: [85],
        myminifactoryCatIds: [406],
      },
      {
        name: "Other Fashion Models",
        metaTitle: "Other Fashion Models",
        metaDescription:
          "Discover a world of endless fashion possibilities with our diverse collection of 3D printed fashion models, including hats, belts, and hair accessories.",
        makerworldCatIds: [207],
        thingiverseCatIds: [81, 130],
        printablesCatIds: [18, 20, 42],
        myminifactoryCatIds: [357],
        snapmakerCatIds: [136, 138],
      },
    ],
  },
  {
    name: "Hobby & DIY",
    metaTitle: "3D Printed Hobby & DIY Models",
    metaDescription:
      "3D Printers are awesome if you are into DIY activities. And this category is just as awesome as a resource for your 3D printing needs related to your DIY hobby. From electronics to RC vehicles or Robotics, you'll find something to get busy with.",
    makerworldCatIds: [300],
    thingiverseCatIds: [66],
    printablesCatIds: [48],
    snapmakerCatIds: [109],
    children: [
      {
        name: "Electronics",
        metaTitle: "3D Printed Equipments for Electronics",
        metaDescription:
          "Elevate your electronics projects with our precision-crafted 3D printed electronic components, enclosures, and accessories.",
        makerworldCatIds: [301],
        thingiverseCatIds: [92],
        printablesCatIds: [52],
        myminifactoryCatIds: [
          59, 943, 328, 378, 329, 941, 275, 113, 326, 647, 375, 488, 489, 490, 491, 492, 648, 507, 633, 670,
        ],
        snapmakerCatIds: [148],
      },
      {
        name: "Music",
        metaTitle: "3D Printed Musical Instruments",
        metaDescription:
          "Create unique and personalized 3D printed musical instruments, from flutes and drums to guitars and synthesizers.",
        makerworldCatIds: [303],
        thingiverseCatIds: [94],
        printablesCatIds: [95],
        myminifactoryCatIds: [68],
        snapmakerCatIds: [152],
      },
      {
        name: "RC",
        metaTitle: "3D Printed RC Models",
        metaDescription:
          "Experience the thrill of crafting and controlling your own 3D printed RC vehicles, drones, and airplanes.",
        makerworldCatIds: [304],
        thingiverseCatIds: [95],
        myminifactoryCatIds: [
          120, 1273, 1274, 1275, 1276, 1277, 1278, 1279, 1280, 1281, 1282, 1283, 1291, 1292, 1299, 360, 975, 983, 984,
          985, 987, 976, 988, 992, 977, 990, 991,
        ],
        snapmakerCatIds: [150],
      },
      {
        name: "Robotics",
        metaTitle: "3D Printed Robotics",
        metaDescription:
          "Explore the world of robotics with our amazing 3D printed robot parts, frames, and actuators.",
        makerworldCatIds: [305],
        thingiverseCatIds: [96],
        printablesCatIds: [64],
        myminifactoryCatIds: [393, 429, 999],
        snapmakerCatIds: [149],
      },
      {
        name: "Sport & Outdoors",
        metaTitle: "3D Printed Sport & Outdoor Models",
        metaDescription:
          "Unleash your athletic spirit and explore the outdoors with Sport & Outdoor! Craft custom gear, design personalized accessories, and discover a world of 3D printed models to fuel your active lifestyle. Start your Sport & Outdoor 3D printing today!",
        makerworldCatIds: [306],
        thingiverseCatIds: [140],
        printablesCatIds: [9, 83, 74, 85, 84],
        myminifactoryCatIds: [56, 69, 71, 966, 967, 968, 114, 342, 550, 551, 962],
        snapmakerCatIds: [154],
      },
      {
        name: "Vehicles",
        metaTitle: "3D Printed Vehicles",
        metaDescription:
          "Design and build your dream 3D printed vehicles, from cars and motorcycles to spaceships and submarines.",
        makerworldCatIds: [302],
        thingiverseCatIds: [155],
        printablesCatIds: [89],
        snapmakerCatIds: [153],
      },
      {
        name: "Other Hobby & DIY",
        metaTitle: "Other Hobby & DIY Models",
        metaDescription:
          "Discover endless possibilities for creativity and self-expression with our diverse collection of 3D printed hobby and DIY models.",
        makerworldCatIds: [307],
        thingiverseCatIds: [93],
        printablesCatIds: [51, 82],
        snapmakerCatIds: [151, 155],
      },
    ],
  },
  {
    name: "Household",
    metaTitle: "3D Printed Household Models",
    metaDescription:
      "If you're reading this, then you probably need to fix or upgrade something in your household by printing one of the various models available. From regular door handles to complex decor designs or useful upgrades for your garden, we're sure there's something useful for you. So get printing!",
    makerworldCatIds: [400],
    thingiverseCatIds: [67],
    printablesCatIds: [3],
    myminifactoryCatIds: [57],
    snapmakerCatIds: [108],
    children: [
      {
        name: "Decor",
        metaTitle: "3D Printed Home Decor",
        metaDescription:
          "Elevate your home décor with our unique and eye-catching 3D printed vases, sculptures, wall hangings, and other decorative items.",
        makerworldCatIds: [401],
        thingiverseCatIds: [97],
        printablesCatIds: [44],
        myminifactoryCatIds: [335, 389, 399, 372, 398, 362, 336],
        snapmakerCatIds: [139],
      },
      {
        name: "Festivities",
        metaTitle: "3D Printed Festival Models",
        metaDescription:
          "Celebrate special occasions and holidays with our festive 3D printed decorations, ornaments, and figurines.",
        makerworldCatIds: [403],
        printablesCatIds: [65, 69, 68, 70],
        myminifactoryCatIds: [385, 384, 634, 635, 636],
        snapmakerCatIds: [140],
      },
      {
        name: "Garden",
        metaTitle: "3D Printed Garden Models",
        metaDescription:
          "Transform your outdoor spaces into a whimsical wonderland with our charming and customizable 3D printed garden ornaments, planters, and sculptures.",
        makerworldCatIds: [402],
        thingiverseCatIds: [98],
        printablesCatIds: [53, 71],
        myminifactoryCatIds: [150],
        snapmakerCatIds: [146],
      },
      {
        name: "Office",
        metaTitle: "3D Printed Office Models",
        metaDescription:
          "Enhance your workspace with our functional and stylish 3D printed office organizers, pen holders, and desk accessories.",
        makerworldCatIds: [404],
        thingiverseCatIds: [101],
        printablesCatIds: [29],
        myminifactoryCatIds: [382, 377],
        snapmakerCatIds: [143],
      },
      {
        name: "Pets",
        metaTitle: "3D Printed Pet Models",
        metaDescription:
          "Create personalized pet accessories and toys with our customizable 3D printed pet tags, bowls, and toys.",
        makerworldCatIds: [405],
        thingiverseCatIds: [103],
        printablesCatIds: [57],
        snapmakerCatIds: [147],
      },
      {
        name: "Other Household Models",
        metaTitle: "Other Household Models",
        metaDescription:
          "Discover a world of endless possibilities for home organization, personalization, and fun with our diverse collection of 3D printed household models.",
        makerworldCatIds: [406],
        thingiverseCatIds: [99, 147, 146, 100, 153],
        printablesCatIds: [5, 6, 139, 4, 7, 45],
        myminifactoryCatIds: [
          370, 381, 371, 369, 397, 88, 445, 452, 502, 823, 824, 825, 826, 827, 833, 942, 828, 829, 830, 831, 832, 902,
          944, 947, 948, 775,
        ],
        snapmakerCatIds: [142, 144, 145, 184],
      },
    ],
  },
  {
    name: "Miniatures",
    metaTitle: "3D Printed Miniatures",
    metaDescription:
      "If you like miniatures, then you've come to the right place. From mystical creatures and animals to architectural designs, we're sure you will find something to spice up your game night!",
    makerworldCatIds: [600],
    thingiverseCatIds: [70],
    printablesCatIds: [101],
    myminifactoryCatIds: [1015],
    snapmakerCatIds: [110],
    children: [
      {
        name: "Animals",
        metaTitle: "3D Printed Animals",
        metaDescription:
          "Populate your gaming worlds with our realistic and detailed 3D printed animals, from majestic dragons to playful pets.",
        makerworldCatIds: [601],
        thingiverseCatIds: [107],
        printablesCatIds: [61],
        snapmakerCatIds: [157],
      },
      {
        name: "Architecture",
        metaTitle: "3D Printed Architectures",
        metaDescription:
          "Construct stunning and realistic 3D printed buildings, castles, and other architectural wonders for your miniature landscapes.",
        makerworldCatIds: [602],
        thingiverseCatIds: [108],
        printablesCatIds: [103, 62],
        myminifactoryCatIds: [787, 1153, 1158, 913],
        snapmakerCatIds: [158],
      },
      {
        name: "Creatures",
        metaTitle: "3D Printed Creatures",
        metaDescription:
          "Unleash your imagination with our collection of fantastical 3D printed creatures, from mythical monsters to mischievous fairies.",
        makerworldCatIds: [603],
        thingiverseCatIds: [109],
        printablesCatIds: [97],
        snapmakerCatIds: [159],
      },
      {
        name: "People",
        metaTitle: "3D Printed People",
        metaDescription:
          "Create diverse and realistic 3D printed characters for your tabletop games, role-playing adventures, and dioramas.",
        makerworldCatIds: [604],
        thingiverseCatIds: [112],
        printablesCatIds: [60],
        myminifactoryCatIds: [785, 780, 782, 783, 784, 1145],
        snapmakerCatIds: [156],
      },
      {
        name: "Other Miniatures",
        metaTitle: "Other Miniatures",
        metaDescription:
          "Discover a vast array of unique and personalized 3D printed miniatures to enhance your gaming experiences and collections.",
        makerworldCatIds: [605],
        thingiverseCatIds: [110, 111, 115, 116],
        printablesCatIds: [104, 105, 75],
        myminifactoryCatIds: [617, 786, 1306, 1310, 1311, 1312, 1313, 1304, 1319, 1325, 1324],
        snapmakerCatIds: [160],
      },
    ],
  },
  {
    name: "Props & Cosplays",
    metaTitle: "3D Printed Props & Cosplays",
    metaDescription:
      "Even if it's not Halloween, there's always time for printing a cool mask, helmet or other cosplay-related prints. Don't wait until it's too late, and start printing your awesome new outfit!",
    makerworldCatIds: [1000],
    printablesCatIds: [76],
    myminifactoryCatIds: [119],
    snapmakerCatIds: [105],
    children: [
      {
        name: "Costumes",
        metaTitle: "3D Printed Costumes",
        metaDescription:
          "Create stunning and authentic 3D printed costumes, from superhero suits to fantasy armor, for your next cosplay event or Halloween.",
        makerworldCatIds: [1003],
        printablesCatIds: [77],
        myminifactoryCatIds: [340],
        snapmakerCatIds: [123],
      },
      {
        name: "Masks & Helmets",
        metaTitle: "3D Printed Masks & Helmets",
        metaDescription:
          "Elevate your cosplay with our detailed and realistic 3D printed masks, helmets, and other facial accessories.",
        makerworldCatIds: [1001],
        printablesCatIds: [78],
        myminifactoryCatIds: [155],
        snapmakerCatIds: [122],
      },
      {
        name: "Cosplay Weapons",
        metaTitle: "3D Printed Props for Cosplay Weapons",
        metaDescription:
          "Dive into the amazing cosplay world with our 3D printed props! We've got finely designed swords and shields, ideal for you to embody your favorite characters. Unleash their power and enjoy immersive role-playing!",
        makerworldCatIds: [1002],
        myminifactoryCatIds: [542, 156, 304],
        snapmakerCatIds: [124],
      },
      {
        name: "Other Props & Cosplays",
        metaTitle: "Other Props & Cosplays",
        metaDescription:
          "Enhance your cosplay with our diverse collection of 3D printed props, accessories, and gadgets to complete your transformation.",
        makerworldCatIds: [1004],
        thingiverseCatIds: [114],
        printablesCatIds: [81, 80],
        snapmakerCatIds: [125],
      },
    ],
  },
  {
    name: "Tools",
    metaTitle: "3D Printed Tools",
    metaDescription:
      "There's never enough tools to have, or a way to organize those tools in an efficient manner. But this section is the perfect location to find the files you need to print a specific jig or an organizer for your latest gadget.",
    makerworldCatIds: [700],
    thingiverseCatIds: [71],
    myminifactoryCatIds: [252],
    snapmakerCatIds: [111],
    children: [
      {
        name: "Gadgets",
        metaTitle: "3D Printed Gadgets",
        metaDescription:
          "Uncover a world of possibilities with our collection of unique and practical 3D printed gadgets, from phone holders to desk organizers.",
        makerworldCatIds: [705],
        thingiverseCatIds: [65],
        printablesCatIds: [21, 25, 27, 26, 28, 100, 140, 43],
        myminifactoryCatIds: [94, 330, 368, 388],
      },
      {
        name: "Hand Tools",
        metaTitle: "3D Printed Hand Tools",
        metaDescription:
          "Enhance your toolbox with our durable and customizable 3D printed hand tools, wrenches, and screwdrivers.",
        makerworldCatIds: [703],
        thingiverseCatIds: [118],
        snapmakerCatIds: [161],
      },
      {
        name: "Machine Tools",
        metaTitle: "3D Printed Machine Tools",
        metaDescription:
          "Upgrade your workshop with our precision-crafted 3D printed machine tools, jigs, and fixtures.",
        makerworldCatIds: [704],
        thingiverseCatIds: [117],
        snapmakerCatIds: [165],
      },
      {
        name: "Measure Tools",
        metaTitle: "3D Printed Measure Tools",
        metaDescription:
          "Ensure precise measurements with our accurate and versatile 3D printed measuring tools, rulers, and calipers.",
        makerworldCatIds: [702],
        snapmakerCatIds: [162],
      },
      {
        name: "Medical Tools",
        metaTitle: "3D Printed Medical Tools",
        metaDescription:
          "Experience the future of medicine with our innovative 3D printed medical tools, surgical guides, and implants.",
        makerworldCatIds: [707],
        printablesCatIds: [87, 88, 99],
        myminifactoryCatIds: [
          288, 110, 1259, 1004, 1022, 1023, 1024, 1006, 1005, 1007, 1008, 1025, 1028, 1029, 1031, 1032, 1033, 1091,
        ],
      },
      {
        name: "Organizers",
        metaTitle: "3D Printed Organizers",
        metaDescription:
          "Keep your workspace and belongings tidy with our functional and customizable 3D printed organizers, trays, and containers.",
        makerworldCatIds: [701],
        thingiverseCatIds: [102, 120],
        printablesCatIds: [50],
        myminifactoryCatIds: [149],
        snapmakerCatIds: [141, 163],
      },
      {
        name: "Other Tools",
        metaTitle: "Other Tools",
        metaDescription:
          "Discover a vast array of specialized and niche 3D printed tools to meet your specific needs and interests.",
        makerworldCatIds: [706],
        thingiverseCatIds: [141, 86, 87, 88, 90, 91, 119],
        printablesCatIds: [49],
        snapmakerCatIds: [164, 166],
      },
    ],
  },
  {
    name: "Toys & Games",
    metaTitle: "3D Printed Toys & Games",
    metaDescription:
      "This section is dedicated to printable fun! You will find various board games, toys, puzzles and games which are all ready to be printed and enjoyed after a quick print.",
    makerworldCatIds: [800],
    thingiverseCatIds: [72],
    printablesCatIds: [30],
    myminifactoryCatIds: [60],
    snapmakerCatIds: [112],
    children: [
      {
        name: "Board Games",
        metaTitle: "3D Printed Board Games",
        metaDescription:
          "Elevate your game nights with our unique and customizable 3D printed board games, chess sets, and game pieces.",
        makerworldCatIds: [802],
        thingiverseCatIds: [122, 113, 151],
        printablesCatIds: [31],
        myminifactoryCatIds: [1014, 523, 1016],
        snapmakerCatIds: [172],
      },
      {
        name: "Characters",
        metaTitle: "3D Printed Characters",
        metaDescription:
          "Create your own personalized 3D printed characters, action figures, and dolls for imaginative play and storytelling.",
        makerworldCatIds: [801],
        printablesCatIds: [36],
        myminifactoryCatIds: [
          104, 67, 435, 442, 496, 532, 533, 436, 536, 537, 538, 539, 540, 541, 543, 544, 733, 927, 957, 1159, 1309,
        ],
        snapmakerCatIds: [171],
      },
      {
        name: "Outdoor Toys",
        metaTitle: "3D Printed Outdoor Toys",
        metaDescription:
          "Encourage active play and outdoor adventures with our durable and engaging 3D printed outdoor toys, frisbees, and sports equipment.",
        makerworldCatIds: [803],
        printablesCatIds: [34],
        snapmakerCatIds: [173],
      },
      {
        name: "Puzzles",
        metaTitle: "3D Printed Puzzles",
        metaDescription:
          "Challenge your mind and test your problem-solving skills with our intricate and captivating 3D printed puzzles.",
        makerworldCatIds: [804],
        thingiverseCatIds: [125],
        printablesCatIds: [33],
        myminifactoryCatIds: [100],
        snapmakerCatIds: [169],
      },
      {
        name: "Construction Sets",
        metaTitle: "3D Printed Construction Sets",
        metaDescription:
          "Build and create incredible structures with our versatile and educational 3D printed construction sets, from classic building blocks to STEM-inspired designs.",
        makerworldCatIds: [806],
        thingiverseCatIds: [121],
        printablesCatIds: [37],
        snapmakerCatIds: [170],
      },
      {
        name: "Other Toys & Games",
        metaTitle: "Other Toys & Games",
        metaDescription:
          "Discover a world of endless possibilities for play, learning, and creativity with our diverse collection of 3D printed toys and games.",
        makerworldCatIds: [805],
        thingiverseCatIds: [149, 124, 123],
        printablesCatIds: [38, 47],
        myminifactoryCatIds: [462, 1308, 1307, 529],
        snapmakerCatIds: [167, 168, 174, 175],
      },
    ],
  },
  {
    name: "Generative 3D Model",
    metaTitle: "Generative 3D Model",
    metaDescription:
      "Here you can find creative models built using 3D model generators. They are beautifully crafted and may provide inspiration on how to utilize these generators.",
    makerworldCatIds: [2000],
    children: [
      {
        name: "Hueforge & Lithophane",
        metaTitle: "Hueforge & Lithophane",
        metaDescription:
          "Transform your favorite images into stunning 3D art pieces with Hueforge and create mesmerizing lithophanes that glow with light.",
        makerworldCatIds: [2001],
      },
      {
        name: "Make My Sign",
        metaTitle: "Make My Sign",
        metaDescription:
          "Create personalized and eye-catching signs using our user-friendly Make My Sign tool, perfect for home décor, businesses, and special occasions.",
        makerworldCatIds: [2002],
      },
      {
        name: "Make My Vase",
        metaTitle: "Make My Vase",
        metaDescription:
          "Design and customize unique and beautiful vases with our intuitive Make My Vase tool, from simple shapes to intricate patterns, solid or hollow.",
        makerworldCatIds: [2003],
      },
      {
        name: "Pixel Puzzle Maker",
        metaTitle: "Pixel Puzzle Maker",
        metaDescription:
          "Convert your cherished images into captivating pixel art puzzles using our Pixel Puzzle Maker tool, perfect for fun challenges and creative displays.",
        makerworldCatIds: [2004],
      },
      {
        name: "Relief Sculpture Maker",
        metaTitle: "Relief Sculpture Maker",
        metaDescription:
          "Elevate your artwork with our 3D to Relief Sculpture tool, seamlessly transforming 3D models or images into stunning bas-relief sculptures.",
        makerworldCatIds: [2005],
      },
      {
        name: "AI Scanner",
        metaTitle: "AI Scanner",
        metaDescription:
          "Recreate 3D assets with remarkable accuracy using our AI Scanner tool, simply capture a continuous video and let the AI do the rest.",
        makerworldCatIds: [2006],
      },
      {
        name: "Image to Keychain",
        metaTitle: "Image to Keychain",
        metaDescription: "Turns images into keychains, bookmarks and other 2D Art models.",
        makerworldCatIds: [2007],
      },
      {
        name: "Make My Desk Organizer",
        metaTitle: "Make My Desk Organizer",
        metaDescription: "Design your perfect desk organizer. Customize every detail to fit exactly what you need.",
        makerworldCatIds: [2008],
      },
      {
        name: "PrintMon Maker",
        metaTitle: "PrintMon Maker",
        metaDescription: "Generate adorable creatures from text or images, ready for 3D printing.",
        makerworldCatIds: [2009],
      },
      {
        name: "Statue Maker",
        metaTitle: "Statue Maker",
        metaDescription: "Turn Your Portrait into a Lifelike 3D Masterpiece.",
        makerworldCatIds: [2010],
      },
      {
        name: "Christmas Ornament Maker",
        metaTitle: "Christmas Ornament Maker",
        metaDescription:
          "Create personalized, spinning 2D Christmas ornaments with the Christmas Ornament Maker, perfect for decorations or gifts.",
        makerworldCatIds: [2011],
      },
      {
        name: "Make My Lantern",
        metaTitle: "Make My Lantern",
        metaDescription: "Generate a hollowed lantern from an image.",
        makerworldCatIds: [2012],
      },
    ],
  },
];
