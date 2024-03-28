elements = {}
connectors = {}
diagrams = {}

function extractClasses(xmlDoc) {
    var xmlclasses = xmlDoc.getElementsByTagName('UML:Class')
    classes = {}

    for (var i = 0; i < xmlclasses.length; i++) {
        xmlclass = xmlclasses[i];
        if (xmlclass.getAttribute('isRoot') == 'false') {
            // extract basic information
            c = {}
            c.name = xmlclass.getAttribute('name')
            c.id = xmlclass.getAttribute('xmi.id')

            // extract information from the tagged values
            taggedValueRoot = xmlclass.getElementsByTagName('UML:ModelElement.taggedValue')
            taggedValues = taggedValueRoot[0].getElementsByTagName('UML:TaggedValue')
            for (var j = 0; j < taggedValues.length; j++) {
                var taggedValue = taggedValues[j];
                if (taggedValue.getAttribute('tag') == 'owner') {
                    c.owner = taggedValue.getAttribute('value');
                }
                if (taggedValue.getAttribute('tag') == 'ea_stype') {
                    c.type = taggedValue.getAttribute('value');
                }
            }

            // add the information to the classes dictionary
            classes[c.id] = c
        }
    }

    return classes
}


function processContents(xmlDoc) {
    classes = extractClasses(xmlDoc)
}

function processFile(file) {
    // Process the file here
    // For example, let's just read it as text
    var reader = new FileReader();
    reader.onload = function(e) {
        var contents = e.target.result;
        // Process contents here
        // The file contains XML. Import the XML to a DOM and then process it
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(contents, 'text/xml');
        var processedContents = processContents(xmlDoc);

        // Create a Blob with the processed contents
        var blob = new Blob([processedContents], {type: 'text/plain'});

        // Create a URL for the Blob
        var url = URL.createObjectURL(blob);

        // Set the href of the download link to the Blob URL and show the link
        var downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = 'processed_' + file.name;
        downloadLink.style.display = 'block';
    };
    reader.readAsText(file);
}

